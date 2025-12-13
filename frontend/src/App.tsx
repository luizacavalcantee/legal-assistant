import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [healthStatus, setHealthStatus] = useState<string>("Verificando...");

  useEffect(() => {
    fetch("http://localhost:3000/health")
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus(data.status === "OK" ? "✅ Conectado" : "❌ Erro");
      })
      .catch(() => {
        setHealthStatus("❌ Servidor não disponível");
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Assistente Jurídico Inteligente</h1>
        <p>Status do Backend: {healthStatus}</p>
      </header>
    </div>
  );
}

export default App;
