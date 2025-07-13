import React, {useState} from 'react';
import './App.css';

function App() {
    const [activeView, setActiveView] = useState('menu');
    const [status, setStatus] = useState('Модель не загружена');
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');

    const handleStartLlama = () => {
        setStatus('Загрузка...');
        fetch('http://localhost:5000/start-llama', {method: 'POST'})
            .then(res => res.json())
            .then(data => setStatus(data.status))
            .catch(() => setStatus('Ошибка при запуске модели'));
    };

    const handleChat = (e) => {
        e.preventDefault();
        fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt}),
        })
            .then(res => res.json())
            .then(data => setResponse(data.response || data.error))
            .catch(() => setResponse('Ошибка при отправке запроса'));
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Локальный запуск Llama</h1>
                <nav>
                    <button onClick={() => setActiveView('menu')}>Меню</button>
                    <button onClick={() => setActiveView('chat')}>Чат</button>
                </nav>

                {activeView === 'menu' && (
                    <div className="view">
                        <h2>Меню управления</h2>
                        <button onClick={handleStartLlama}>Запустить модель Llama</button>
                        <p>Статус: {status}</p>
                    </div>
                )}

                {activeView === 'chat' && (
                    <div className="view">
                        <h2>Общение с моделью</h2>
                        <form onSubmit={handleChat}>
              <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Введите ваш запрос..."
              />
                            <button type="submit">Отправить</button>
                        </form>
                        {response && <div className="response"><p>{response}</p></div>}
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;