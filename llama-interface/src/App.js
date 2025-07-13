import React, {useEffect, useRef, useState} from 'react';
import './App.css';

function App() {
    const [activeView, setActiveView] = useState('menu');
    const [status, setStatus] = useState('Модель не загружена');
    const [userInput, setUserInput] = useState('');
    const [conversation, setConversation] = useState([]);
    const chatEndRef = useRef(null);

    // Функция для прокрутки чата вниз
    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({behavior: "smooth"});
    };

    // Загрузка истории при переключении на чат
    useEffect(() => {
        if (activeView === 'chat') {
            fetchHistory();
        }
    }, [activeView]);

    // Прокрутка при обновлении диалога
    useEffect(() => {
        scrollToBottom();
    }, [conversation]);


    const fetchHistory = () => {
        fetch('http://localhost:5000/history')
            .then(res => res.json())
            .then(data => setConversation(data))
            .catch(() => console.error('Ошибка при загрузке истории'));
    };

    const handleStartLlama = () => {
        setStatus('Загрузка...');
        fetch('http://localhost:5000/start-llama', {method: 'POST'})
            .then(res => res.json())
            .then(data => setStatus(data.status))
            .catch(() => setStatus('Ошибка при запуске модели'));
    };

    const handleClearHistory = () => {
        fetch('http://localhost:5000/clear-history', {method: 'POST'})
            .then(() => setConversation([]))
            .catch(() => console.error('Ошибка при очистке истории'));
    }

    const handleChatSubmit = (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const newUserMessage = {sender: 'user', message: userInput};
        // Оптимистичное обновление: сразу показываем сообщение пользователя
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
                    // В случае ошибки, откатываем оптимистичное обновление
                    setConversation(prev => prev.slice(0, -1));
                    alert(`Ошибка: ${fullHistory.error}`);
                } else {
                    setConversation(fullHistory);
                }
            })
            .catch(() => {
                alert('Критическая ошибка при отправке запроса');
                setConversation(prev => prev.slice(0, -1)); // Откат
            });
    };

    return (
        <div
            className="App"
            style={{
                '--active-view-is-menu': activeView === 'menu' ? 'var(--md-sys-color-primary)' : 'transparent',
                '--active-view-is-menu-color': activeView === 'menu' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                '--active-view-is-chat': activeView === 'chat' ? 'var(--md-sys-color-primary)' : 'transparent',
                '--active-view-is-chat-color': activeView === 'chat' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
            }}
        >
            <header className="App-header">
                <h1>Локальный чат с Llama</h1>
                <nav>
                    <button onClick={() => setActiveView('menu')}>Меню</button>
                    <button onClick={() => setActiveView('chat')}>Чат</button>
                </nav>

                {activeView === 'menu' && (
                    <div className="view">
                        <h2>Меню управления</h2>
                        <button onClick={handleStartLlama}>Запустить модель Llama</button>
                        <p>Статус: {status}</p>
                        <button onClick={handleClearHistory}>Очистить историю чата</button>
                    </div>
                )}

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