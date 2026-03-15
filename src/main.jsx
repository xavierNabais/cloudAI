import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './index.css';

const container = document.getElementById('app');
if (container) {
    try {
        const root = createRoot(container);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    } catch (error) {
        console.error('Erro ao renderizar aplicação:', error);
        container.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Erro ao carregar aplicação</h1><p>Verifique o console para mais detalhes.</p></div>';
    }
} else {
    console.error('Elemento #app não encontrado');
}
