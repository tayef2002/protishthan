-- =====================================================================
-- Guardian dashboard: published results + monthly fee status (Phase 2)
--
-- exam_marks / exams / fee tables stay CLOSED to the anon key. Guardians
-- get data only through these two functions, which first check that the
-- phone number really belongs to a guardian of that student, and return
-- only that student's data (results: only exams the admin has published).
--
-- When guardian login moves to PIN/OTP, only the check at the top of each
-- function needs to change.
-- Run in Supabase SQL Editor. Safe to re-run.
-- =====================================================================

-- ---------- Published exam results ----------
-- Returns one object per published exam of the child's class:
--   { id, name, exam_date, exam_type, subjects,
--     class_marks: [ { me: bool, marks: [ {subject, marks_obtained, is_absent} ] } ] }
-- class_marks carries classmates' marks WITHOUT names/ids, so the page can
-- compute merit position and subject-highest exactly like exam.html does.
CREATE OR REPLACE FUNCTION public.guardian_results(p_phone text, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
BEGIN
  IF p_phone IS NULL OR NOT EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.student_id = p_student_id AND g.whatsapp_number = p_phone
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT s.class_id INTO v_class FROM students s WHERE s.id = p_student_id;

  RETURN COALESCE((
    SELECT jsonb_agg(x.obj ORDER BY x.exam_date DESC NULLS LAST, x.created_at DESC)
    FROM (
      SELECT e.exam_date, e.created_at,
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'exam_date', e.exam_date,
          'exam_type', e.exam_type,
          'subjects', COALESCE(e.subjects, '[]'::jsonb),
          'class_marks', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'me', s.id = p_student_id,
              'marks', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'subject', m.subject,
                  'marks_obtained', m.marks_obtained,
                  'is_absent', m.is_absent))
                FROM exam_marks m
                WHERE m.exam_id = e.id AND m.student_id = s.id
              ), '[]'::jsonb)))
            FROM students s
            WHERE s.class_id = e.class_id AND s.is_active
          ), '[]'::jsonb)
        ) AS obj
      FROM exams e
      WHERE e.is_locked = true AND e.class_id = v_class
    ) x
  ), '[]'::jsonb);
END;
$$;

-- ---------- Monthly fee status ----------
-- Returns { monthly_fee, start_month, start_year, payments: [...] }.
-- The page lists due months the same way fee-management.html does:
-- academic-year start month -> current month, any month without a 'paid' row.
CREATE OR REPLACE FUNCTION public.guardian_fees(p_phone text, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee numeric;
  v_inst institutions%ROWTYPE;
  v_inst_id uuid;
BEGIN
  IF p_phone IS NULL OR NOT EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.student_id = p_student_id AND g.whatsapp_number = p_phone
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COALESCE(s.custom_monthly_fee, c.monthly_fee, 0), s.institution_id
    INTO v_fee, v_inst_id
  FROM students s LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id;

  SELECT * INTO v_inst FROM institutions WHERE id = v_inst_id;

  RETURN jsonb_build_object(
    'monthly_fee', v_fee,
    'start_month', v_inst.academic_year_start_month,
    'start_year', v_inst.academic_year_en,
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', p.month, 'amount', p.amount, 'status', p.status,
        'payment_method', p.payment_method, 'paid_at', p.paid_at,
        'voucher_no', p.voucher_no) ORDER BY p.month DESC)
      FROM fee_payments p WHERE p.student_id = p_student_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_results(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardian_fees(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardian_results(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_fees(text, uuid) TO anon, authenticated;
