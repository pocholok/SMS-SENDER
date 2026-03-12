import { useState, useEffect, useRef } from 'react';
import { Key, Phone, Send, Trash2, Play, Square, Settings, Terminal, RefreshCw } from 'lucide-react';

function App() {
  // State
  const [apiKey, setApiKey] = useState('0116C375');
  const [apiSecret, setApiSecret] = useState('SyGTjnercV8G');
  const [apiUrl, setApiUrl] = useState('http://8.219.42.83:20003/sms/send'); 
  const [balanceUrl, setBalanceUrl] = useState('http://8.219.42.83:20003/sms/balance'); 
  const [balanceMethod, setBalanceMethod] = useState('POST');
  const [balance, setBalance] = useState(null);
  const [numbersText, setNumbersText] = useState('573024141138');
  const [sentLog, setSentLog] = useState([]);
  const [message, setMessage] = useState('b-pa.lat');
  const [speed, setSpeed] = useState(10);
  const [batchSize, setBatchSize] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [allowResend, setAllowResend] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  
  // Refs for managing the sending loop
  const isSendingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Helper to add system logs
  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${text}`]);
  };

  useEffect(() => {
    // Initial log
    addLog('[SYSTEM] Listo. Configura usuario y contraseña.');
  }, []);

  // Scroll console to bottom
  const consoleEndRef = useRef(null);
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const checkBalance = async () => {
    addLog(`Consultando saldo (${balanceMethod})...`, 'info');
    try {
      let fetchUrl = balanceUrl;
      // CORS HANDLING for balance
      // Detectar si necesitamos usar el proxy (si la URL apunta a nuestro backend objetivo)
      if (balanceUrl.includes('8.219.42.83') || balanceUrl.includes('login.oak-tel.com')) {
         fetchUrl = balanceUrl.replace(/^https?:\/\/[^\/]+/, '/proxy');
      }

      const options = {
        method: balanceMethod,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (balanceMethod === 'POST') {
        options.body = JSON.stringify({
          user: apiKey,
          password: apiSecret
        });
      } else {
        // GET Request: Append query params manually
        // Check if url already has params
        const separator = fetchUrl.includes('?') ? '&' : '?';
        fetchUrl = `${fetchUrl}${separator}user=${encodeURIComponent(apiKey)}&password=${encodeURIComponent(apiSecret)}`;
      }

      const response = await fetch(fetchUrl, options);
 
       const contentType = response.headers.get("content-type");
       if (contentType && contentType.indexOf("application/json") === -1) {
          const text = await response.text();
          // If HTML, it's likely a wrong URL or auth page
          if (text.trim().startsWith('<')) {
            throw new Error(`La URL configurada es una página web (HTML), no la API. Por favor consulta a soporte de Oak Tel por la "URL de la API HTTP".`);
          }
          throw new Error(`Respuesta no válida (no es JSON): ${text.substring(0, 50)}...`);
       }

       if (!response.ok) {
         const errText = await response.text();
         throw new Error(`Error ${response.status}: ${errText}`);
       }
 
       const data = await response.json();
       setBalance(JSON.stringify(data)); 
       addLog(`Saldo recibido: ${JSON.stringify(data)}`, 'success');
     } catch (error) {
       console.error(error);
       addLog(`Error: ${error.message}`, 'error');
       setBalance('Error');
     }
   };

  const handleStart = async () => {
    if (isSending) return;
    if (!apiKey) {
      addLog('Error: Faltan credenciales API', 'error');
      return;
    }
    
    const numbers = numbersText.split('\n').filter(n => n.trim().length > 0);
    if (numbers.length === 0) {
      addLog('Error: No hay números para enviar', 'error');
      return;
    }

    setIsSending(true);
    isSendingRef.current = true;
    setProgress(0);
    addLog(`Iniciando envío a ${numbers.length} números...`);

    // Sending process in batches
    for (let i = 0; i < numbers.length; i += batchSize) {
      if (!isSendingRef.current) break;

      const chunk = numbers.slice(i, i + batchSize);
      
      // Simulate API call delay based on speed
      const delay = Math.max(100, 1000 - (speed * 90)); 
      await new Promise(resolve => setTimeout(resolve, delay));

      // Process batch concurrently
      await Promise.all(chunk.map(async (number) => {
        if (!isSendingRef.current) return;

        const cleanNumber = number.trim();
        if (!cleanNumber) return;

        // Variable Replacement Logic
        let currentMessage = message
          .replace(/\$numero\$/g, cleanNumber)
          .replace(/\$name\$/g, 'Usuario')
          .replace(/\$deuda\$/g, '0.00');

        try {
          // CORS HANDLING: Use local proxy
          let fetchUrl = apiUrl;
          if (apiUrl.includes('8.219.42.83') || apiUrl.includes('login.oak-tel.com')) {
             fetchUrl = apiUrl.replace(/^https?:\/\/[^\/]+/, '/proxy');
          }

          const response = await fetch(fetchUrl, {  
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user: apiKey,
              password: apiSecret,
              phone: cleanNumber,
              text: currentMessage
            })
          });

          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") === -1) {
             const text = await response.text();
             if (text.trim().startsWith('<')) {
               throw new Error(`URL incorrecta (devuelve HTML)`);
             }
          }

          if (!response.ok) {
             const errText = await response.text();
             throw new Error(`API Error ${response.status}: ${errText}`);
          }
          
          setSentLog(prev => [...prev, { number: cleanNumber, status: 'success', time: new Date().toLocaleTimeString() }]);
          addLog(`Enviado a: ${cleanNumber}`);
          setProgress(prev => prev + 1);

        } catch (apiError) {
          console.error(apiError);
          addLog(`Error en ${cleanNumber}: ${apiError.message}`, 'error');
        }
      }));
    }

    setIsSending(false);
    isSendingRef.current = false;
    addLog('Proceso finalizado.');
  };

  const handleStop = () => {
    if (isSendingRef.current) {
      isSendingRef.current = false;
      setIsSending(false);
      addLog('Proceso detenido por el usuario.', 'warning');
    }
  };

  const insertTag = (tag) => {
    setMessage(prev => prev + ` ${tag} `);
  };

  const clearNumbers = () => setNumbersText('');
  const clearSent = () => setSentLog([]);

  return (
    <div className="min-h-screen bg-black text-white p-4 font-mono text-sm">
      
      {/* Top Bar: Credentials */}
      <div className="bg-dark-800 border border-dark-600 rounded p-3 mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-blue-400 min-w-[140px]">
            <Key size={18} />
            <span className="font-bold">Credenciales</span>
          </div>
          <input 
            type="text" 
            placeholder="API URL (ej: https://api.site.com/send)" 
            className="bg-dark-700 border border-dark-600 rounded px-3 py-1 flex-[2] focus:outline-none focus:border-blue-500 text-gray-300 text-xs font-mono"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4">
             <div className="min-w-[140px] text-right pr-3 text-xs text-gray-500">Balance URL</div>
             <div className="flex-[2] flex gap-2">
               <input 
                 type="text" 
                 placeholder="Balance URL"
                 className="bg-dark-700 border border-dark-600 rounded px-3 py-1 flex-[2] focus:outline-none focus:border-blue-500 text-gray-300 text-xs font-mono"
                 value={balanceUrl}
                 onChange={(e) => setBalanceUrl(e.target.value)}
               />
               <select 
                  value={balanceMethod}
                  onChange={(e) => setBalanceMethod(e.target.value)}
                  className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
               >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
               </select>
               <button 
                 onClick={checkBalance}
                 className="bg-dark-700 hover:bg-dark-600 text-gray-300 border border-dark-600 px-3 py-1 rounded text-xs transition-colors"
               >
                 Consultar Saldo
               </button>
             </div>
          </div>

        <div className="flex items-center gap-4">
           <div className="min-w-[140px] text-right pr-3 text-xs text-gray-500">Saldo</div>
            <input 
              type="text" 
              readOnly
              placeholder="Presiona 'Consultar Saldo' para ver el resultado" 
              className="bg-dark-900 border border-dark-600 rounded px-3 py-1 flex-[2] focus:outline-none text-green-400 text-xs font-mono"
              value={balance || ''}
            />
        </div>

        <div className="flex items-center gap-4">
           <div className="min-w-[140px]"></div> {/* Spacer */}
          <input 
            type="text" 
            placeholder="API Key / User" 
            className="bg-dark-700 border border-dark-600 rounded px-3 py-1 flex-1 focus:outline-none focus:border-blue-500"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Password / Secret" 
            className="bg-dark-700 border border-dark-600 rounded px-3 py-1 flex-1 focus:outline-none focus:border-blue-500"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-1 rounded font-bold transition-colors">
            Guardar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-100px)]">
        
        {/* Left Column: Numbers */}
        <div className="col-span-4 bg-dark-800 border border-dark-600 rounded flex flex-col">
          <div className="p-2 border-b border-dark-600 flex justify-between items-center bg-dark-900">
            <div className="flex items-center gap-2 text-orange-400">
              <Phone size={16} />
              <span className="font-bold">Números</span>
            </div>
            <div className="flex gap-2">
              <button className="text-xs bg-dark-700 hover:bg-dark-600 px-2 py-1 rounded border border-dark-600 text-gray-300">
                Filtrar enviados
              </button>
              <button 
                onClick={clearNumbers}
                className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded font-bold"
              >
                Limpiar
              </button>
            </div>
          </div>
          <textarea 
            className="flex-1 bg-dark-800 p-3 focus:outline-none resize-none text-gray-300 font-mono"
            placeholder="Ingresa números aquí..."
            value={numbersText}
            onChange={(e) => setNumbersText(e.target.value)}
          />
          <div className="p-1 bg-dark-900 text-xs text-right text-gray-500">
            {numbersText.split('\n').filter(n => n.trim()).length} números
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-8 flex flex-col gap-4">
          
          {/* Sent Log */}
          <div className="h-48 bg-dark-800 border border-dark-600 rounded flex flex-col">
            <div className="p-2 border-b border-dark-600 flex justify-between items-center bg-dark-900">
              <div className="flex items-center gap-2 text-orange-200">
                <Send size={16} />
                <span className="font-bold">Enviados</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">{sentLog.length} enviados</span>
                <button 
                  onClick={clearSent}
                  className="text-xs bg-dark-700 hover:bg-dark-600 px-2 py-1 rounded border border-dark-600 text-gray-300"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {sentLog.length === 0 ? (
                <div className="text-gray-600 text-center mt-10">No hay mensajes enviados aún</div>
              ) : (
                sentLog.map((log, idx) => (
                  <div key={idx} className="text-xs text-green-400 border-b border-dark-700 py-1">
                    [{log.time}] Enviado a {log.number}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Message Composer */}
          <div className="bg-dark-800 border border-dark-600 rounded flex flex-col">
            <div className="p-2 border-b border-dark-600 bg-dark-900 flex gap-2">
              <button onClick={() => insertTag('$name$')} className="text-xs bg-cyan-900 text-cyan-200 px-2 py-0.5 rounded border border-cyan-800 hover:bg-cyan-800">$name$</button>
              <button onClick={() => insertTag('$deuda$')} className="text-xs bg-cyan-900 text-cyan-200 px-2 py-0.5 rounded border border-cyan-800 hover:bg-cyan-800">$deuda$</button>
              <button onClick={() => insertTag('$numero$')} className="text-xs bg-cyan-900 text-cyan-200 px-2 py-0.5 rounded border border-cyan-800 hover:bg-cyan-800">$numero$</button>
            </div>
            <textarea 
              className="h-24 bg-dark-800 p-3 focus:outline-none resize-none text-gray-200"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="p-1 bg-dark-900 text-xs text-right text-gray-500">
              {message.length}/1024
            </div>
          </div>

          {/* Controls */}
          <div className="bg-dark-800 border border-dark-600 rounded p-3">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex flex-col">
                <label className="text-xs text-gray-400 mb-1">Velocidad</label>
                <select 
                  value={speed}
                  onChange={(e) => setSpeed(parseInt(e.target.value))}
                  className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm focus:outline-none"
                >
                  <option value="1">1 (Lento)</option>
                  <option value="5">5 (Normal)</option>
                  <option value="10">10 (Turbo)</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-400 mb-1">Hilos (Simultáneos)</label>
                <select 
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm focus:outline-none w-24"
                >
                  <option value="1">1 (Uno a uno)</option>
                  <option value="10">10 (Rápido)</option>
                  <option value="20">20 (Muy rápido)</option>
                  <option value="50">50 (Máximo)</option>
                </select>
              </div>
              
              <button 
                onClick={handleStart}
                disabled={isSending}
                className={`flex-1 ${isSending ? 'bg-orange-800 cursor-not-allowed' : 'bg-primary-500 hover:bg-primary-600'} text-black font-bold py-2 rounded flex justify-center items-center gap-2 transition-colors`}
              >
                {isSending ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                ENVIAR
              </button>
              
              <button 
                onClick={handleStop}
                disabled={!isSending}
                className={`w-24 ${!isSending ? 'bg-red-900 opacity-50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white font-bold py-2 rounded flex justify-center items-center gap-2 transition-colors`}
              >
                <Square size={18} />
                PARAR
              </button>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <input 
                type="checkbox" 
                id="resend" 
                checked={allowResend}
                onChange={(e) => setAllowResend(e.target.checked)}
                className="rounded bg-dark-700 border-dark-600"
              />
              <label htmlFor="resend" className="text-xs text-gray-400 select-none cursor-pointer">Permitir reenviar ya enviados</label>
            </div>

            {/* Progress */}
            <div className="w-full bg-dark-900 rounded-full h-2 mb-1">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${numbersText.split('\n').filter(n=>n.trim()).length > 0 ? (progress / numbersText.split('\n').filter(n=>n.trim()).length) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 font-mono">
              <span>{progress}/{numbersText.split('\n').filter(n=>n.trim()).length}</span>
              <span>00:00:00</span>
              <span>ETA --:--:--</span>
            </div>
          </div>

          {/* Console Log */}
          <div className="flex-1 bg-black border border-dark-600 rounded p-2 overflow-auto font-mono text-xs h-32">
            {logs.map((log, idx) => (
              <div key={idx} className="text-green-500">{log}</div>
            ))}
            <div ref={consoleEndRef} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
