import { useState } from 'react';
import { Sparkles, Copy, Check, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface TranslationResult {
  sql: string;
  confidence: string;
  patterns_used: string[];
  warnings: string[];
}

export default function DaxTranslator() {
  const [daxInput, setDaxInput] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const translate = async () => {
    if (!daxInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/translate/expression', {
        dax_expression: daxInput
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-400" />
        DAX to SQL Translator
      </h2>
      
      <textarea
        value={daxInput}
        onChange={(e) => setDaxInput(e.target.value)}
        placeholder="Enter DAX expression..."
        className="w-full h-32 p-3 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm"
      />
      
      <button
        onClick={translate}
        disabled={loading || !daxInput.trim()}
        className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded flex items-center gap-2"
      >
        {loading ? 'Translating...' : 'Translate'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">SQL Output ({result.confidence} confidence)</span>
            <button onClick={copyToClipboard} className="text-slate-400 hover:text-white">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <pre className="p-3 bg-slate-800 border border-slate-600 rounded text-green-400 font-mono text-sm overflow-x-auto">
            {result.sql}
          </pre>
        </div>
      )}
    </div>
  );
}







