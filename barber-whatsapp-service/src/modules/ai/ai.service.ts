import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BookingService } from '../booking/booking.service';
import { PrismaService } from '../database/prisma.service';
import { AIContextService } from './ai-context.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class AIService {
  private openai: OpenAI;
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly bookingService: BookingService,
    private readonly prisma: PrismaService,
    private readonly aiContextService: AIContextService,
    private readonly metricsService: MetricsService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || 'mock-key';
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Helper para chamar a OpenAI aplicando um timeout estrito de 10 segundos (Fase 3)
   */
  private async callOpenAIWithTimeout(
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout (OpenAI Timeout)

    this.metricsService.incrementOpenAIRequests();

    try {
      const response = await this.openai.chat.completions.create(params, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.metricsService.incrementOpenAIFailures();
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
        throw new Error('TIMEOUT_OPENAI');
      }
      throw err;
    }
  }

  /**
   * Processa o chat do cliente injetando o contexto dinâmico multi-tenant da barbearia
   */
  async processChat(
    barbershopId: string,
    clientId: string,
    clientName: string,
    clientMessage: string,
  ): Promise<string> {
    // 1. Recupera o histórico de mensagens recentes (últimas 15) do banco
    const messageHistory = await this.prisma.message.findMany({
      where: { clientId },
      orderBy: { timestamp: 'asc' },
      take: 15,
    });

    const formattedHistory: OpenAI.Chat.ChatCompletionMessageParam[] = messageHistory.map((msg) => ({
      role: msg.fromMe ? 'assistant' : 'user',
      content: msg.text,
    }));

    // 2. Constrói o contexto dinâmico da barbearia e do cliente
    const context = await this.aiContextService.buildContext(barbershopId, clientId);

    const now = new Date();
    const currentDateTimeStr = now.toLocaleString('pt-BR', { timeZone: context.barbershop.timezone });

    // 3. Prompt do Sistema Otirnizado (FASE 4)
    const systemPrompt: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'system',
      content: `Você é a recepcionista virtual de uma barbearia premium.
Nome do cliente: ${clientName}.
Data e hora atual de referência: ${currentDateTimeStr}.

CONTEXTO DO SISTEMA EM REAL-TIME (JSON):
${JSON.stringify(context, null, 2)}

Instruções cruciais de comportamento (V2):
1. Fale sempre em português do Brasil de maneira natural, educada e calorosa.
2. NUNCA mencione que você é uma inteligência artificial ou um robô. Responda como se fosse a recepcionista humana da barbearia.
3. REGRA CRÍTICA: Você não sabe nada sobre horários disponíveis, preços, barbeiros ou serviços além do que está contido no JSON de contexto acima ou retornado pelas ferramentas. Se os dados não estiverem lá, você DEVE consultar as funções adequadas antes de responder. Nunca invente/alucine barbeiros, preços ou horários.
4. Responda com frases curtas e objetivas, ideais para leitura rápida no WhatsApp. Use emojis com moderação para parecer amigável.
5. Use o nome do cliente e faça referência a dados do histórico dele para gerar identificação imediata (ex: "Vi que seu último corte foi o Fade com o João. Deseja repetir?").
6. O expediente é das 09:00 às 18:00 (apenas horas cheias).
7. Para agendar, você DEVE solicitar o serviço e o barbeiro. Apresente as opções que estão no contexto. Quando o cliente escolher, chame 'criarAgendamento' com o serviceId e o barberId corretos obtidos das funções.
8. Para consultar horários de hoje ou amanhã, chame 'listarHorariosHoje' ou 'listarHorariosAmanha'.`
    };

    const currentUserMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'user',
      content: clientMessage,
    };

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      systemPrompt,
      ...formattedHistory,
      currentUserMessage,
    ];

    // Configuração de todas as Tools do Function Calling (FASE 4)
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'buscarHorariosDisponiveis',
          description: 'Busca os horários livres em uma determinada data no formato AAAA-MM-DD.',
          parameters: {
            type: 'object',
            properties: {
              dateStr: {
                type: 'string',
                description: 'A data a pesquisar (AAAA-MM-DD). Opcional.',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'criarAgendamento',
          description: 'Cria uma nova reserva para o cliente.',
          parameters: {
            type: 'object',
            properties: {
              dateTimeStr: {
                type: 'string',
                description: 'A data e hora no formato AAAA-MM-DD HH:MM (ex: 2026-06-16 14:00).',
              },
              serviceId: {
                type: 'string',
                description: 'ID do serviço a ser agendado (UUID).',
              },
              barberId: {
                type: 'string',
                description: 'ID do barbeiro escolhido (UUID).',
              },
              notes: {
                type: 'string',
                description: 'Observações adicionais para o barbeiro.',
              },
            },
            required: ['dateTimeStr', 'serviceId', 'barberId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'cancelarAgendamento',
          description: 'Cancela um agendamento futuro ativo do cliente.',
          parameters: {
            type: 'object',
            properties: {
              appointmentId: {
                type: 'string',
                description: 'ID único do agendamento (UUID). Opcional.',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remarcarAgendamento',
          description: 'Altera data/hora de um agendamento ativo.',
          parameters: {
            type: 'object',
            properties: {
              appointmentId: {
                type: 'string',
                description: 'ID único do agendamento (UUID). Opcional.',
              },
              newDateTimeStr: {
                type: 'string',
                description: 'Nova data e hora no formato AAAA-MM-DD HH:MM.',
              },
            },
            required: ['newDateTimeStr'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'buscarCliente',
          description: 'Busca os dados completos de cadastro do cliente atual.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'buscarHistoricoCliente',
          description: 'Busca os agendamentos antigos e histórico de visitas do cliente.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'buscarBarbeiros',
          description: 'Retorna a lista de profissionais barbeiros ativos na barbearia.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'buscarServicos',
          description: 'Retorna a lista de cortes, barbas e tratamentos disponíveis.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'consultarPrecoServico',
          description: 'Retorna o preço de um serviço específico pelo ID.',
          parameters: {
            type: 'object',
            properties: {
              serviceId: {
                type: 'string',
                description: 'ID do serviço (UUID).',
              },
            },
            required: ['serviceId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'consultarProximoAgendamento',
          description: 'Busca o agendamento futuro mais próximo marcado para o cliente.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'listarHorariosHoje',
          description: 'Retorna os horários livres para o dia de hoje.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'listarHorariosAmanha',
          description: 'Retorna os horários livres para o dia de amanhã.',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];

    try {
      // Chamada protegida por timeout para OpenAI
      let response = await this.callOpenAIWithTimeout({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
      });

      let responseMessage = response.choices[0].message;

      const maxSteps = 5;
      let step = 0;

      while (responseMessage.tool_calls && step < maxSteps) {
        step++;
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== 'function') {
            continue;
          }
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          let functionResult = '';

          try {
            this.logger.log(`[IA Executando]: ${functionName} com: ${JSON.stringify(functionArgs)}`);

            if (functionName === 'buscarHorariosDisponiveis') {
              const res = await this.bookingService.buscarHorariosDisponiveis(clientId, barbershopId, functionArgs.dateStr);
              functionResult = JSON.stringify({ success: true, availableSlots: res });
            } else if (functionName === 'criarAgendamento') {
              const res = await this.bookingService.criarAgendamento(
                clientId,
                barbershopId,
                functionArgs.dateTimeStr,
                functionArgs.serviceId,
                functionArgs.barberId,
                functionArgs.notes,
              );
              functionResult = JSON.stringify({ success: true, appointment: res });
            } else if (functionName === 'cancelarAgendamento') {
              const res = await this.bookingService.cancelarAgendamento(clientId, barbershopId, functionArgs.appointmentId);
              functionResult = JSON.stringify({ success: true, message: 'Cancelado com sucesso.', appointment: res });
            } else if (functionName === 'remarcarAgendamento') {
              const res = await this.bookingService.remarcarAgendamento(clientId, barbershopId, functionArgs.appointmentId, functionArgs.newDateTimeStr);
              functionResult = JSON.stringify({ success: true, message: 'Remarcado com sucesso.', appointment: res });
            } else if (functionName === 'buscarCliente') {
              const res = await this.prisma.client.findUnique({ where: { id: clientId } });
              functionResult = JSON.stringify({ success: true, client: res });
            } else if (functionName === 'buscarHistoricoCliente') {
              const res = await this.prisma.appointment.findMany({
                where: { clientId, barbershopId, deletedAt: null },
                include: { service: true, barber: true },
                orderBy: { dateTime: 'desc' },
                take: 5,
              });
              functionResult = JSON.stringify({ success: true, appointments: res });
            } else if (functionName === 'buscarBarbeiros') {
              const res = await this.prisma.barber.findMany({ where: { barbershopId, active: true, deletedAt: null } });
              functionResult = JSON.stringify({ success: true, barbers: res });
            } else if (functionName === 'buscarServicos') {
              const res = await this.prisma.service.findMany({ where: { barbershopId, active: true, deletedAt: null } });
              functionResult = JSON.stringify({ success: true, services: res });
            } else if (functionName === 'consultarPrecoServico') {
              const res = await this.prisma.service.findFirst({ where: { id: functionArgs.serviceId, barbershopId, deletedAt: null } });
              functionResult = JSON.stringify({ success: true, service: res });
            } else if (functionName === 'consultarProximoAgendamento') {
              const res = await this.prisma.appointment.findFirst({
                where: { clientId, barbershopId, status: { not: 'CANCELLED' }, dateTime: { gte: new Date() }, deletedAt: null },
                orderBy: { dateTime: 'asc' },
                include: { service: true, barber: true },
              });
              functionResult = JSON.stringify({ success: true, appointment: res });
            } else if (functionName === 'listarHorariosHoje') {
              const todayStr = new Date().toISOString().split('T')[0];
              const res = await this.bookingService.buscarHorariosDisponiveis(clientId, barbershopId, todayStr);
              functionResult = JSON.stringify({ success: true, date: todayStr, availableSlots: res });
            } else if (functionName === 'listarHorariosAmanha') {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];
              const res = await this.bookingService.buscarHorariosDisponiveis(clientId, barbershopId, tomorrowStr);
              functionResult = JSON.stringify({ success: true, date: tomorrowStr, availableSlots: res });
            } else {
              functionResult = JSON.stringify({ error: `Função ${functionName} não encontrada.` });
            }
          } catch (err: any) {
            this.logger.warn(`Erro na função ${functionName}: ${err.message}`);
            functionResult = JSON.stringify({ success: false, error: err.message || 'Erro de processamento.' });
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: functionResult,
          });
        }

        // Chamada protegida por timeout no loop
        response = await this.callOpenAIWithTimeout({
          model: 'gpt-4o-mini',
          messages,
          tools,
        });

        responseMessage = response.choices[0].message;
      }

      // Controle de custos e Uso da IA (FASE 10)
      try {
        const usage = response.usage;
        if (usage) {
          const inputTokens = usage.prompt_tokens;
          const outputTokens = usage.completion_tokens;
          const cost = (inputTokens * 0.15 + outputTokens * 0.60) / 1000000;

          await this.prisma.aIUsage.create({
            data: {
              barbershopId,
              inputTokens,
              outputTokens,
              cost,
            },
          });
        }
      } catch (usageErr) {
        // Silencia
      }

      return responseMessage.content || 'Desculpe, não consegui processar a mensagem.';
    } catch (error: any) {
      this.logger.error(`Erro OpenAI: ${error.stack || error.message}`);
      
      // OpenAI Circuit Breaker Fallback (Fase 3)
      if (error.message === 'TIMEOUT_OPENAI' || error.status === 429 || error.status >= 500) {
        return 'Olá! No momento estou verificando os horários. Um atendente retornará em instantes.';
      }
      
      return 'Olá! Desculpe, estou passando por instabilidades no meu servidor e não consigo responder no momento. Por favor, tente novamente em alguns instantes.';
    }
  }
}
