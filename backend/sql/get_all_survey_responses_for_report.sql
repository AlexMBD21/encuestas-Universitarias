-- Función SQL para permitir que los profesores puedan ver las respuestas globales en los reportes, 
-- ignorando temporalmente la seguridad a nivel de filas (RLS) en los mismos.
-- Debe ejecutarse directamente en el SQL Editor de Supabase.

CREATE OR REPLACE FUNCTION get_all_survey_responses_for_report(p_survey_id text)
RETURNS SETOF survey_responses
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM survey_responses WHERE survey_id = p_survey_id;
$$;
