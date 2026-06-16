'use client';

import React, { useState } from 'react';
import { MessageSquare, X, Star, CheckCircle } from 'lucide-react';
import api from '../../lib/api/axios';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [ratingAgenda, setRatingAgenda] = useState<number>(5);
  const [ratingWhatsapp, setRatingWhatsapp] = useState<number>(5);
  const [ratingIA, setRatingIA] = useState<number>(5);
  const [ratingDashboard, setRatingDashboard] = useState<number>(5);
  const [ratingSupport, setRatingSupport] = useState<number>(5);
  const [nps, setNps] = useState<number>(10);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const categories = [
    { label: '🗓️ Agenda & Horários', value: ratingAgenda, setter: setRatingAgenda },
    { label: '💬 Integração WhatsApp', value: ratingWhatsapp, setter: setRatingWhatsapp },
    { label: '🤖 IA Recepcionista', value: ratingIA, setter: setRatingIA },
    { label: '📊 Dashboard & Relatórios', value: ratingDashboard, setter: setRatingDashboard },
    { label: '📞 Suporte & Ajuda', value: ratingSupport, setter: setRatingSupport },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Registra a ação no log de utilização
      await api.post('/usage/log', { action: 'SUBMIT_FEEDBACK' });

      // Envia o feedback estruturado
      await api.post('/feedback', {
        ratingAgenda,
        ratingWhatsapp,
        ratingIA,
        ratingDashboard,
        ratingSupport,
        nps,
        comment,
      });

      setIsSuccess(true);
      // Reset form
      setRatingAgenda(5);
      setRatingWhatsapp(5);
      setRatingIA(5);
      setRatingDashboard(5);
      setRatingSupport(5);
      setNps(10);
      setComment('');
    } catch (err: any) {
      console.error('Erro ao enviar feedback:', err);
      setErrorMsg(err.response?.data?.message || 'Erro de conexão com o servidor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    setIsSuccess(false);
    setErrorMsg(null);
    try {
      await api.post('/usage/log', { action: 'OPEN_FEEDBACK_MODAL' });
    } catch (err) {
      console.warn('Erro ao registrar log de abertura de feedback', err);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-3 font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 hover:shadow-amber-500/30 focus:outline-none"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="hidden sm:inline text-sm">Feedback do Piloto</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Opinião do Usuário Piloto</h3>
                <p className="text-xs text-zinc-400">Ajude-nos a otimizar o BarberAI para sua operação</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isSuccess ? (
              /* Sucesso */
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
                <h4 className="text-xl font-bold text-white">Muito obrigado!</h4>
                <p className="text-sm text-zinc-400 max-w-md">
                  Suas avaliações e observações foram salvas na telemetria do Piloto 01. Analisamos todas as sugestões para a próxima versão comercial (V1.1).
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  Fechar Janela
                </button>
              </div>
            ) : (
              /* Formulário */
              <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                {errorMsg && (
                  <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-3 text-xs text-red-400">
                    {errorMsg}
                  </div>
                )}

                {/* Categorias */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-300">Como você avalia o funcionamento de cada módulo?</h4>
                  <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-4 space-y-3">
                    {categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-zinc-900/40 last:border-0">
                        <span className="text-zinc-300 font-medium">{cat.label}</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => cat.setter(star)}
                              className="text-zinc-500 hover:text-amber-400 transition-colors p-0.5"
                            >
                              <Star 
                                className={`h-4.5 w-4.5 ${
                                  star <= cat.value 
                                    ? 'fill-amber-400 text-amber-400' 
                                    : 'text-zinc-600'
                                }`} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NPS */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-300">
                    De 0 a 10, o quanto você recomendaria o BarberAI para outra barbearia?
                  </h4>
                  <div className="flex flex-wrap items-center justify-between gap-1 rounded-xl border border-zinc-900 bg-zinc-950/50 p-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setNps(score)}
                        className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${
                          nps === score
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-zinc-950 scale-105'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 px-1">
                    <span>Definitivamente Não (0)</span>
                    <span>Altamente Recomendado (10)</span>
                  </div>
                </div>

                {/* Comentário */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-300">
                    Críticas, sugestões ou depoimentos livres:
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Nos conte como tem sido sua experiência real..."
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-2 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Satisfação'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
