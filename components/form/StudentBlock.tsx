import FormField from './FormField';

interface StudentBlockProps {
  studentName: string;
  course: string;
  division: string;
  onChange: (name: string, value: string) => void;
  errors?: Partial<Record<'studentName' | 'course' | 'division', string>>;
}

export default function StudentBlock({
  studentName,
  course,
  division,
  onChange,
  errors,
}: StudentBlockProps) {
  return (
    <div className="bg-brand-tint rounded-banner p-3 mt-2 flex flex-col gap-2">
      <div className="text-[11px] font-bold text-brand">Estudiante del colegio</div>
      <p className="text-[11px] text-ink-soft">
        Para que el premio vuelva al curso correcto.
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <FormField
            label="Estudiante"
            name="studentName"
            value={studentName}
            onChange={onChange}
            placeholder="Nombre"
            error={errors?.studentName}
            autoComplete="off"
          />
        </div>
        <div className="w-[60px]">
          <FormField
            label="Año"
            name="course"
            value={course}
            onChange={onChange}
            placeholder="Año"
            error={errors?.course}
            inputMode="numeric"
            maxLength={3}
            autoComplete="off"
          />
        </div>
        <div className="w-[52px]">
          <FormField
            label="Div."
            name="division"
            value={division}
            onChange={onChange}
            placeholder="A"
            error={errors?.division}
            maxLength={2}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
