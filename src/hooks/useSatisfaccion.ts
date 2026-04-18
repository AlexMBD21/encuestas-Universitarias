import { useState, useEffect } from 'react';
import { getSatisfaccionByToken, submitSatisfaccion, SatisfaccionPayload } from '../services/satisfaccion.service';

export function useSatisfaccion(token: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyData, setSurveyData] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      
      if (!token) {
        setError('Token inválido o no proporcionado.');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const data = await getSatisfaccionByToken(token);
      
      if (!data) {
        setError('No se encontró la encuesta o el token es incorrecto.');
      } else if (data.__expired) {
        // Surface expired to the UI component
        setSurveyData(data);
      } else if (data.__publicMode) {
        // Shared link: always allow filling the form
        setSurveyData(data);
      } else if (data.respondida) {
        setError('Esta encuesta de satisfacción ya ha sido completada anteriormente.');
      } else if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
        setError('El enlace de esta encuesta ha expirado.');
      } else {
        setSurveyData(data);
      }
      setLoading(false);
    }
    load();
  }, [token]);

  const submit = async (payload: SatisfaccionPayload, publicMode?: { survey_id: string }) => {
    if (!token || !surveyData) return false;
    setIsSubmitting(true);
    
    const finalPayload = { ...payload, respondida_en: new Date().toISOString() };
    const success = await submitSatisfaccion(token, finalPayload, publicMode);
    
    setIsSubmitting(false);
    if (success) {
      setIsSuccess(true);
      return true;
    }
    
    return false;
  };

  return { loading, error, surveyData, isSubmitting, isSuccess, submit };
}
