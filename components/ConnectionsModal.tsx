
import React from 'react';
import { type ServiceIntegration, ServiceAccount } from '../types';

interface ConnectionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    integrations: ServiceIntegration[];
    onToggle: (serviceId: string, accountId?: string) => void;
}

interface ToggleSwitchProps {
    checked: boolean;
    onChange: () => void;
    label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => (
    <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 ${
            checked ? 'bg-cyan-500' : 'bg-slate-600'
        }`}
    >
        <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${
                checked ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);


export const ConnectionsModal: React.FC<ConnectionsModalProps> = ({ isOpen, onClose, integrations, onToggle }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="connections-title"
        >
            <div 
                className="bg-slate-800/80 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <header className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 id="connections-title" className="text-lg font-bold text-slate-200">Manage Connections</h2>
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full text-slate-400 hover:bg-slate-700"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <p className="text-sm text-slate-400">
                        Connect your personal accounts to give Nanda's assistant context and enable proactive assistance. Your data is processed securely.
                    </p>
                    <ul className="space-y-1">
                        {integrations.map(integration => (
                            <li key={integration.id} className="p-3 bg-slate-900/50 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <integration.icon className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold text-slate-200">{integration.name}</p>
                                            <p className="text-xs text-slate-400">{integration.description}</p>
                                        </div>
                                    </div>
                                    {/* If the integration does not have sub-accounts, show a single toggle */}
                                    {!integration.accounts && (
                                        <ToggleSwitch 
                                            checked={integration.connected}
                                            onChange={() => onToggle(integration.id)}
                                            label={`Connect ${integration.name}`}
                                        />
                                    )}
                                </div>
                                {/* If the integration has sub-accounts (e.g., email), list them with individual toggles */}
                                {integration.accounts && (
                                    <div className="mt-3 pl-10 space-y-2 border-l border-slate-700 ml-3">
                                        {integration.accounts.map(account => (
                                            <div key={account.id} className="flex items-center justify-between pl-4">
                                                <p className="text-sm text-slate-300">{account.id}</p>
                                                <ToggleSwitch
                                                    checked={account.connected}
                                                    onChange={() => onToggle(integration.id, account.id)}
                                                    label={`Connect ${account.id}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};