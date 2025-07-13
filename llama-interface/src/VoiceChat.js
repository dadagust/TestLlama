import React, {useRef, useState} from 'react';

// Компонент для иконки микрофона
const MicIcon = ({isRecording}) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        {isRecording ? (
            <path
                d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
        ) : (
            <path
                d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11h-1.7c0 2.42-1.72 4.44-4.01 4.9v2.26c2.89-.46 5.01-2.9 5.01-5.66zM5 11h1.7c0 2.42 1.72 4.44 4.01 4.9v2.26C7.11 17.64 5 15.1 5 12.24V11z"/>
        )}
    </svg>
);

const VoiceChat = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("Нажмите на микрофон для начала разговора");

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioPlayerRef = useRef(null);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = handleSendAudio;

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setStatusText("Я вас слушаю...");
        } catch (err) {
            console.error("Ошибка доступа к микрофону:", err);
            setStatusText("Не удалось получить доступ к микрофону.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true);
            setStatusText("Обработка вашего запроса...");
        }
    };

    const handleSendAudio = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {type: 'audio/wav'});
        const formData = new FormData();
        formData.append('audio', audioBlob, 'user_audio.wav');

        audioChunksRef.current = []; // Очищаем чанки для следующей записи

        try {
            const response = await fetch('http://localhost:5000/voice-chat', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.statusText}`);
            }

            const responseAudioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(responseAudioBlob);

            audioPlayerRef.current.src = audioUrl;
            audioPlayerRef.current.play();
            setStatusText("Воспроизведение ответа...");

            audioPlayerRef.current.onended = () => {
                setStatusText("Нажмите на микрофон для начала разговора");
                setIsProcessing(false);
            };

        } catch (error) {
            console.error('Ошибка при отправке аудио:', error);
            setStatusText("Произошла ошибка. Попробуйте снова.");
            setIsProcessing(false);
        }
    };

    return (
        <div className="voice-chat-container">
            <p className="voice-status">{statusText}</p>

            <button
                className={`record-button ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing}
            >
                <MicIcon isRecording={isRecording}/>
            </button>

            <audio ref={audioPlayerRef} style={{display: 'none'}}/>
        </div>
    );
};

export default VoiceChat;