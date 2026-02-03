import React from 'react';
import { AlertCircle, LogOut } from 'lucide-react';

interface CompanySuspendedModalProps {
    companyName: string;
    suspensionReason?: string;
    onLogout: () => void;
}

const CompanySuspendedModal: React.FC<CompanySuspendedModalProps> = ({
    companyName,
    suspensionReason,
    onLogout
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full mx-4 animate-in zoom-in slide-in-from-bottom-4 duration-500">
                {/* Header com ícone de alerta */}
                <div className="p-8 text-center">
                    <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-700 delay-150">
                        <AlertCircle className="text-red-600 dark:text-red-500" size={40} />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 animate-in slide-in-from-bottom-2 duration-500 delay-200">
                        Acesso Temporariamente Suspenso
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 animate-in slide-in-from-bottom-2 duration-500 delay-300">
                        O acesso da empresa <span className="font-bold text-slate-700 dark:text-slate-300">{companyName}</span> foi suspenso.
                    </p>

                    {/* Motivo da suspensão */}
                    {suspensionReason && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 mb-6 animate-in slide-in-from-bottom-2 duration-500 delay-400">
                            <p className="text-sm font-bold text-red-900 dark:text-red-200 mb-2">
                                Motivo da Suspensão:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {suspensionReason}
                            </p>
                        </div>
                    )}

                    {/* Informações adicionais */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 mb-6 animate-in slide-in-from-bottom-2 duration-500 delay-500">
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            Para reativar o acesso, entre em contato com o suporte ou resolva as pendências indicadas.
                            Todos os dados estão seguros e serão restaurados assim que o acesso for reativado.
                        </p>
                    </div>

                    {/* Botão de logout */}
                    <button
                        onClick={onLogout}
                        className="w-full py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-sm animate-in slide-in-from-bottom-2 duration-500 delay-600"
                    >
                        <LogOut size={18} />
                        Fazer Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanySuspendedModal;
