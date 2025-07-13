import React, {useEffect, useRef, useState} from 'react';
import VoiceChat from "./VoiceChat";
import './App.css';

function App() {
    const [activeView, setActiveView] = useState('menu');
    const [modelStatus, setModelStatus] = useState({});
    const [userInput, setUserInput] = useState('');
    const [conversation, setConversation] = useState([]);
    const chatEndRef = useRef(null);

    useEffect(() => {
        fetch('http://localhost:5000/status')
            .then(res => res.json())
            .then(data => setModelStatus(data));
    }, []);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({behavior: "smooth"});
    };

    useEffect(() => {
        if (activeView === 'chat') {
            fetchHistory();
        }
    }, [activeView]);

    useEffect(() => {
        scrollToBottom();
    }, [conversation]);

    const handleStartModels = () => {
        setModelStatus({llama: 'Загрузка...', whisper: 'Загрузка...', tts: 'Загрузка...'});
        fetch('http://localhost:5000/start-models', {method: 'POST'})
            .then(res => res.json())
            .then(data => {
                // Начинаем периодически проверять статус
                const interval = setInterval(() => {
                    fetch('http://localhost:5000/status')
                        .then(res => res.json())
                        .then(statusData => {
                            setModelStatus(statusData);
                            // Проверяем, что все модели загружены, и останавливаем проверку
                            if (statusData.llama === 'Загружена' && statusData.whisper === 'Загружена' && statusData.tts === 'Загружена') {
                                clearInterval(interval);
                            }
                        });
                }, 3000);
            })
            .catch(() => setModelStatus({info: 'Ошибка при запуске'}));
    };

    const fetchHistory = () => {
        fetch('http://localhost:5000/history')
            .then(res => res.json())
            .then(data => setConversation(data))
            .catch(() => console.error('Ошибка при загрузке истории'));
    };

    const handleClearHistory = () => {
        fetch('http://localhost:5000/clear-history', {method: 'POST'})
            .then(() => setConversation([]))
            .catch(() => console.error('Ошибка при очистке истории'));
    };

    const handleChatSubmit = (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const newUserMessage = {sender: 'user', message: userInput};
        setConversation(prev => [...prev, newUserMessage]);
        setUserInput('');

        fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message: userInput}),
        })
            .then(res => res.json())
            .then(fullHistory => {
                if (fullHistory.error) {
                    setConversation(prev => prev.slice(0, -1));
                    alert(`Ошибка: ${fullHistory.error}`);
                } else {
                    setConversation(fullHistory);
                }
            })
            .catch(() => {
                alert('Критическая ошибка при отправке запроса');
                setConversation(prev => prev.slice(0, -1));
            });
    };

    return (
        <div className="App" style={{
            '--active-view-is-menu': activeView === 'menu' ? 'var(--md-sys-color-primary)' : 'transparent',
            '--active-view-is-menu-color': activeView === 'menu' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
            '--active-view-is-voice': activeView === 'voice' ? 'var(--md-sys-color-primary)' : 'transparent',
            '--active-view-is-voice-color': activeView === 'voice' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
            '--active-view-is-chat': activeView === 'chat' ? 'var(--md-sys-color-primary)' : 'transparent',
            '--active-view-is-chat-color': activeView === 'chat' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
        }}>
            <header className="App-header">
                <h1>Локальный Ассистент</h1>
                <nav>
                    <button onClick={() => setActiveView('menu')}>Меню</button>
                    <button onClick={() => setActiveView('voice')}>Голосовой чат</button>
                    <button onClick={() => setActiveView('chat')}>Текстовый чат</button>
                </nav>

                {/* ЕДИНСТВЕННЫЙ И ПРАВИЛЬНЫЙ БЛОК ДЛЯ МЕНЮ */}
                {activeView === 'menu' && (
                    <div className="view">
                        <h2>Меню управления</h2>
                        <button onClick={handleStartModels}>Запустить все модели</button>
                        <div className="status-grid">
                            <p>Llama (LLM): <span>{modelStatus.llama || 'Неизвестно'}</span></p>
                            <p>Whisper (STT): <span>{modelStatus.whisper || 'Неизвестно'}</span></p>
                            <p>TTS (Синтез): <span>{modelStatus.tts || 'Неизвестно'}</span></p>
                        </div>
                        <button onClick={handleClearHistory}>Очистить историю чата</button>
                    </div>
                )}

                {activeView === 'voice' && <VoiceChat/>}

                {/* ДУБЛИРУЮЩИЙСЯ БЛОК БЫЛ УДАЛЕН */}

                {activeView === 'chat' && (
                    <div className="view chat-view">
                        <div className="chat-window">
                            {conversation.map((entry, index) => (
                                <div key={index} className={`message ${entry.sender}`}>
                                    <p>{entry.message}</p>
                                </div>
                            ))}
                            <div ref={chatEndRef}/>
                        </div>
                        <form onSubmit={handleChatSubmit} className="chat-form">
                            <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Введите ваше сообщение..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleChatSubmit(e);
                                    }
                                }}
                            />
                            <button type="submit">Отправить</button>
                        </form>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;