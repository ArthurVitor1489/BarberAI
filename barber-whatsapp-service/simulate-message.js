const axios = require('axios');

async function main() {
  const messageText = process.argv[2] || 'Olá! Gostaria de agendar um corte degradê.';
  const phone = process.argv[3] || '5511977777777'; // Fallback: Ricardo Humano
  const pushName = process.argv[4] || 'Ricardo Humano'; // Fallback: Ricardo Humano
  const messageId = `msg-sim-${Date.now()}`;

  console.log(`Simulando recebimento de mensagem via WhatsApp...`);
  console.log(`Cliente: ${pushName} (${phone})`);
  console.log(`Mensagem: "${messageText}"`);

  try {
    const response = await axios.post('http://localhost:3000/whatsapp/webhook', {
      event: 'messages.upsert',
      instance: 'barbearia-piloto-wa',
      data: {
        key: {
          remoteJid: `${phone}@s.whatsapp.net`,
          fromMe: false,
          id: messageId
        },
        pushName: pushName,
        message: {
          conversation: messageText
        }
      }
    });

    console.log('\nStatus da resposta do webhook:', response.data);
    console.log('Mensagem processada com sucesso pelo backend!');
    console.log('Abra o painel web (http://localhost:3001) para ver a resposta gerada pela IA na conversa de ' + pushName + '.');
  } catch (error) {
    console.error('Erro ao simular webhook:', error.response ? error.response.data : error.message);
  }
}

main();

