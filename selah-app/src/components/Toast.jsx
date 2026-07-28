import { useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const color = type === 'success' ? 'text-success border-success/30' : 'text-danger border-danger/30';
    const Icon = type === 'success' ? CheckCircle : AlertCircle;

    return (
        <div className="fixed bottom-24 right-5 z-50 animate-slideIn">
            <div className={`flex items-center gap-3 bg-elevated border ${color} px-4 py-3 rounded-xl shadow-xl`}>
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    );
}