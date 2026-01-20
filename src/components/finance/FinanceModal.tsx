"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Collaborator,
  CollaboratorPaymentType,
  ExpenseCategory,
  ExpenseType,
  FinanceAccountName,
  FinanceModalType,
  FinanceStatus,
  TransferMovementType,
} from "@/lib/finance/types";
import { listCollaborators } from "@/services/finance";

export type IncomeFormValues = {
  clientName: string;
  projectService: string;
  amount: number;
  incomeDate: string;
  expectedPayDate: string;
  accountDestination: FinanceAccountName;
  responsible: FinanceAccountName;
  status: FinanceStatus;
  reference: string;
  notes: string;
};

export type CollaboratorFormValues = {
  nombreCompleto: string;
  rolPuesto: string;
  tipoPago: CollaboratorPaymentType;
  montoBase: number;
  moneda: "PEN";
  cuentaPagoPreferida: FinanceAccountName;
  diaPago: number | "";
  fechaPago: string;
  inicioContrato: string;
  finContrato: string;
  activo: boolean;
  notas: string;
};

export type CollaboratorPaymentFormValues = {
  colaboradorId: string;
  periodo: string;
  montoBase: number;
  bono: number;
  descuento: number;
  devolucion: number;
  montoFinal: number;
  fechaPago: string;
  cuentaOrigen: FinanceAccountName;
  estado: FinanceStatus;
  referencia: string;
  notas: string;
};

export type ExpenseFormValues = {
  tipoGasto: ExpenseType;
  categoria: ExpenseCategory;
  descripcion: string;
  monto: number;
  fechaGasto: string;
  cuentaOrigen: FinanceAccountName;
  responsable: FinanceAccountName;
  estado: FinanceStatus;
  requiereDevolucion: boolean;
  devolucionMonto: number;
  referencia: string;
  notas: string;
};

export type TransferFormValues = {
  tipoMovimiento: TransferMovementType;
  cuentaOrigen: FinanceAccountName | "";
  cuentaDestino: FinanceAccountName | "";
  monto: number;
  fecha: string;
  responsable: FinanceAccountName;
  referencia: string;
  notas: string;
};

type FinanceFormValuesMap = {
  income: IncomeFormValues;
  collaborator: CollaboratorFormValues;
  collaborator_payment: CollaboratorPaymentFormValues;
  expense: ExpenseFormValues;
  transfer: TransferFormValues;
};

type FinanceField = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  showWhen?: (values: FinanceFormValuesMap[FinanceModalType]) => boolean;
};

type FinanceFormConfig<T extends FinanceModalType> = {
  title: string;
  description: string;
  defaultValues: FinanceFormValuesMap[T];
  schema: (values: FinanceFormValuesMap[T]) => Record<string, string>;
  fields: (context: { collaborators: Collaborator[] }) => FinanceField[];
};

const accountOptions = [
  { value: "LUIS", label: "Luis" },
  { value: "ALONDRA", label: "Alondra" },
  { value: "KIMCE", label: "Kimce" },
];

const s = (v?: string) => (v ?? "").trim();

const statusOptions = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CANCELADO", label: "Cancelado" },
];

const financeFormRegistry: { [Key in FinanceModalType]: FinanceFormConfig<Key> } = {
  income: {
    title: "Nuevo ingreso",
    description: "Registra un ingreso y asocia el cliente.",
    defaultValues: {
      clientName: "",
      projectService: "",
      amount: 0,
      incomeDate: new Date().toISOString().slice(0, 10),
      expectedPayDate: "",
      accountDestination: "LUIS",
      responsible: "LUIS",
      status: "PENDIENTE",
      reference: "",
      notes: "",
    },
    schema: (values) => {
      const errors: Record<string, string> = {};
      if (!s(values.clientName)) errors.clientName = "Cliente es requerido";
      if (!values.incomeDate) errors.incomeDate = "Fecha requerida";
      if (!values.accountDestination) errors.accountDestination = "Cuenta requerida";
      if (values.amount <= 0 || Number.isNaN(values.amount)) errors.amount = "Monto inválido";
      return errors;
    },
    fields: () => [
      { name: "clientName", label: "Cliente", type: "text", placeholder: "Ej: Belcorp" },
      {
        name: "projectService",
        label: "Proyecto/Servicio",
        type: "text",
        placeholder: "Ej: Marketing",
      },
      { name: "amount", label: "Monto", type: "number", placeholder: "0", min: 0 },
      { name: "incomeDate", label: "Fecha de ingreso", type: "date" },
      { name: "expectedPayDate", label: "Fecha de pago esperada", type: "date" },
      {
        name: "accountDestination",
        label: "Cuenta destino",
        type: "select",
        options: accountOptions,
      },
      { name: "responsible", label: "Responsable", type: "select", options: accountOptions },
      { name: "status", label: "Estado", type: "select", options: statusOptions },
      {
        name: "reference",
        label: "Referencia / código interno",
        type: "text",
        placeholder: "REF-VENTA-001",
      },
      { name: "notes", label: "Notas", type: "textarea", placeholder: "Observaciones…" },
    ],
  },
  collaborator: {
    title: "Nuevo colaborador",
    description: "Agrega un colaborador con condiciones de pago.",
    defaultValues: {
      nombreCompleto: "",
      rolPuesto: "",
      tipoPago: "MENSUAL",
      montoBase: 0,
      moneda: "PEN",
      cuentaPagoPreferida: "LUIS",
      diaPago: "",
      fechaPago: "",
      inicioContrato: new Date().toISOString().slice(0, 10),
      finContrato: "",
      activo: true,
      notas: "",
    },
    schema: (values) => {
      const errors: Record<string, string> = {};
      if (!s(values.nombreCompleto)) errors.nombreCompleto = "Nombre requerido";
      if (!s(values.rolPuesto)) errors.rolPuesto = "Rol requerido";
      if (values.montoBase <= 0 || Number.isNaN(values.montoBase)) errors.montoBase = "Monto inválido";
      if (!values.inicioContrato) errors.inicioContrato = "Fecha requerida";
      const hasDay = values.diaPago !== "";
      const hasDate = Boolean(values.fechaPago);
      if (!hasDay && !hasDate) {
        errors.diaPago = "Indica día de pago o fecha puntual";
      }
      if (hasDay && typeof values.diaPago === "number" && (values.diaPago < 1 || values.diaPago > 31)) {
        errors.diaPago = "Día entre 1 y 31";
      }
      return errors;
    },
    fields: () => [
      { name: "nombreCompleto", label: "Nombre completo", type: "text" },
      { name: "rolPuesto", label: "Rol / Puesto", type: "text" },
      {
        name: "tipoPago",
        label: "Tipo de pago",
        type: "select",
        options: [
          { value: "MENSUAL", label: "Mensual" },
          { value: "POR_PROYECTO", label: "Por proyecto" },
          { value: "POR_HORAS", label: "Por horas" },
        ],
      },
      { name: "montoBase", label: "Monto base", type: "number", placeholder: "0", min: 0 },
      {
        name: "moneda",
        label: "Moneda",
        type: "select",
        options: [{ value: "PEN", label: "PEN" }],
      },
      {
        name: "cuentaPagoPreferida",
        label: "Cuenta de pago preferida",
        type: "select",
        options: accountOptions,
      },
      {
        name: "diaPago",
        label: "Día de pago (1-31)",
        type: "number",
        placeholder: "Ej: 15",
        min: 1,
        max: 31,
      },
      { name: "fechaPago", label: "Fecha de pago puntual", type: "date" },
      { name: "inicioContrato", label: "Inicio de contrato", type: "date" },
      { name: "finContrato", label: "Fin de contrato", type: "date" },
      { name: "activo", label: "Activo", type: "checkbox" },
      { name: "notas", label: "Notas", type: "textarea", placeholder: "Observaciones…" },
    ],
  },
  collaborator_payment: {
    title: "Registrar pago",
    description: "Registra un pago a colaborador por periodo.",
    defaultValues: {
      colaboradorId: "",
      periodo: "",
      montoBase: 0,
      bono: 0,
      descuento: 0,
      devolucion: 0,
      montoFinal: 0,
      fechaPago: new Date().toISOString().slice(0, 10),
      cuentaOrigen: "LUIS",
      estado: "PENDIENTE",
      referencia: "",
      notas: "",
    },
    schema: (values) => {
      const errors: Record<string, string> = {};
      if (!values.colaboradorId) errors.colaboradorId = "Selecciona colaborador";
      if (!s(values.periodo)) errors.periodo = "Periodo requerido";
      if (values.montoBase <= 0 || Number.isNaN(values.montoBase)) errors.montoBase = "Monto inválido";
      if (!values.fechaPago) errors.fechaPago = "Fecha requerida";
      if (!values.cuentaOrigen) errors.cuentaOrigen = "Cuenta requerida";
      return errors;
    },
    fields: (context) => [
      {
        name: "colaboradorId",
        label: "Colaborador",
        type: "select",
        options: context.collaborators.map((collaborator) => ({
          value: collaborator.id,
          label: collaborator.nombreCompleto,
        })),
      },
      { name: "periodo", label: "Periodo (mes/año)", type: "text", placeholder: "09/2024" },
      { name: "montoBase", label: "Monto base", type: "number", placeholder: "0", min: 0 },
      { name: "bono", label: "Bono", type: "number", placeholder: "0", min: 0 },
      { name: "descuento", label: "Descuento", type: "number", placeholder: "0", min: 0 },
      { name: "devolucion", label: "Devolución", type: "number", placeholder: "0", min: 0 },
      {
        name: "montoFinal",
        label: "Monto final",
        type: "number",
        placeholder: "0",
        min: 0,
        readOnly: true,
      },
      { name: "fechaPago", label: "Fecha de pago", type: "date" },
      {
        name: "cuentaOrigen",
        label: "Cuenta origen",
        type: "select",
        options: accountOptions,
      },
      { name: "estado", label: "Estado", type: "select", options: statusOptions },
      {
        name: "referencia",
        label: "Referencia",
        type: "text",
        placeholder: "REF-PAGO-001",
      },
      { name: "notas", label: "Notas", type: "textarea", placeholder: "Observaciones…" },
    ],
  },
  expense: {
    title: "Nuevo gasto",
    description: "Registra un gasto operativo o administrativo.",
    defaultValues: {
      tipoGasto: "FIJO",
      categoria: "SUNAT",
      descripcion: "",
      monto: 0,
      fechaGasto: new Date().toISOString().slice(0, 10),
      cuentaOrigen: "LUIS",
      responsable: "LUIS",
      estado: "PENDIENTE",
      requiereDevolucion: false,
      devolucionMonto: 0,
      referencia: "",
      notas: "",
    },
    schema: (values) => {
      const errors: Record<string, string> = {};
      if (!s(values.descripcion)) errors.descripcion = "Descripción requerida";
      if (values.monto <= 0 || Number.isNaN(values.monto)) errors.monto = "Monto inválido";
      if (!values.fechaGasto) errors.fechaGasto = "Fecha requerida";
      if (values.requiereDevolucion && values.devolucionMonto <= 0) {
        errors.devolucionMonto = "Devolución requerida";
      }
      return errors;
    },
    fields: () => [
      {
        name: "tipoGasto",
        label: "Tipo de gasto",
        type: "select",
        options: [
          { value: "FIJO", label: "Fijo" },
          { value: "VARIABLE", label: "Variable" },
        ],
      },
      {
        name: "categoria",
        label: "Categoría",
        type: "select",
        options: [
          { value: "SUNAT", label: "SUNAT" },
          { value: "OPERATIVOS", label: "Operativos" },
          { value: "HERRAMIENTAS", label: "Herramientas" },
          { value: "SERVICIOS", label: "Servicios" },
          { value: "TRASLADO", label: "Traslado" },
          { value: "OTROS", label: "Otros" },
        ],
      },
      { name: "descripcion", label: "Descripción", type: "text" },
      { name: "monto", label: "Monto", type: "number", placeholder: "0", min: 0 },
      { name: "fechaGasto", label: "Fecha de gasto", type: "date" },
      {
        name: "cuentaOrigen",
        label: "Cuenta origen",
        type: "select",
        options: accountOptions,
      },
      { name: "responsable", label: "Responsable", type: "select", options: accountOptions },
      { name: "estado", label: "Estado", type: "select", options: statusOptions },
      { name: "requiereDevolucion", label: "Requiere devolución", type: "checkbox" },
      {
        name: "devolucionMonto",
        label: "Monto de devolución",
        type: "number",
        placeholder: "0",
        min: 0,
        showWhen: (values) => Boolean((values as ExpenseFormValues).requiereDevolucion),
      },
      {
        name: "referencia",
        label: "Referencia",
        type: "text",
        placeholder: "REF-GASTO-001",
      },
      { name: "notas", label: "Notas", type: "textarea", placeholder: "Observaciones…" },
    ],
  },
  transfer: {
    title: "Transferencia / Movimiento de caja",
    description: "Registra transferencias y movimientos entre cuentas.",
    defaultValues: {
      tipoMovimiento: "TRANSFERENCIA",
      cuentaOrigen: "",
      cuentaDestino: "",
      monto: 0,
      fecha: new Date().toISOString().slice(0, 10),
      responsable: "LUIS",
      referencia: "",
      notas: "",
    },
    schema: (values) => {
      const errors: Record<string, string> = {};
      if (!values.fecha) errors.fecha = "Fecha requerida";
      if (values.monto <= 0 || Number.isNaN(values.monto)) errors.monto = "Monto inválido";
      if (values.tipoMovimiento === "TRANSFERENCIA") {
        if (!values.cuentaOrigen) errors.cuentaOrigen = "Cuenta origen requerida";
        if (!values.cuentaDestino) errors.cuentaDestino = "Cuenta destino requerida";
        if (values.cuentaOrigen && values.cuentaDestino && values.cuentaOrigen === values.cuentaDestino) {
          errors.cuentaDestino = "No puede ser igual a origen";
        }
      } else if (values.tipoMovimiento === "INGRESO_CAJA") {
        if (!values.cuentaDestino) errors.cuentaDestino = "Cuenta requerida";
        if (values.cuentaOrigen) errors.cuentaOrigen = "Solo una cuenta";
      } else if (values.tipoMovimiento === "SALIDA_CAJA") {
        if (!values.cuentaOrigen) errors.cuentaOrigen = "Cuenta requerida";
        if (values.cuentaDestino) errors.cuentaDestino = "Solo una cuenta";
      }
      return errors;
    },
    fields: () => [
      {
        name: "tipoMovimiento",
        label: "Tipo de movimiento",
        type: "select",
        options: [
          { value: "TRANSFERENCIA", label: "Transferencia" },
          { value: "INGRESO_CAJA", label: "Ingreso a caja" },
          { value: "SALIDA_CAJA", label: "Salida de caja" },
        ],
      },
      {
        name: "cuentaOrigen",
        label: "Cuenta origen",
        type: "select",
        options: accountOptions,
        showWhen: (values) => (values as TransferFormValues).tipoMovimiento !== "INGRESO_CAJA",
      },
      {
        name: "cuentaDestino",
        label: "Cuenta destino",
        type: "select",
        options: accountOptions,
        showWhen: (values) => (values as TransferFormValues).tipoMovimiento !== "SALIDA_CAJA",
      },
      { name: "monto", label: "Monto", type: "number", placeholder: "0", min: 0 },
      { name: "fecha", label: "Fecha", type: "date" },
      { name: "responsable", label: "Responsable", type: "select", options: accountOptions },
      {
        name: "referencia",
        label: "Referencia",
        type: "text",
        placeholder: "REF-TRANS-001",
      },
      { name: "notas", label: "Notas", type: "textarea", placeholder: "Observaciones…" },
    ],
  },
};

interface FinanceModalProps {
  isOpen: boolean;
  modalType: FinanceModalType;
  onClose: () => void;
  onSubmit: (modalType: FinanceModalType, values: FinanceFormValuesMap[FinanceModalType]) => void;
  disabled?: boolean;
}

export default function FinanceModal({
  isOpen,
  modalType,
  onClose,
  onSubmit,
  disabled,
}: FinanceModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const config = financeFormRegistry[modalType];
  const [form, setForm] = useState<FinanceFormValuesMap[FinanceModalType]>(config.defaultValues);
  const [lastCollaboratorId, setLastCollaboratorId] = useState("");
  const collaboratorId =
    modalType === "collaborator_payment" ? (form as CollaboratorPaymentFormValues).colaboradorId : "";

  useEffect(() => {
    if (isOpen) {
      setCollaborators(listCollaborators());
      setForm(config.defaultValues);
      setLastCollaboratorId("");
    }
  }, [config.defaultValues, isOpen]);

  useEffect(() => {
    if (modalType !== "collaborator_payment") return;
    if (!collaboratorId || collaboratorId === lastCollaboratorId) return;
    const collaborator = collaborators.find((item) => item.id === collaboratorId);
    if (!collaborator) return;
    setForm((prev) => ({
      ...prev,
      montoBase: collaborator.montoBase,
    }));
    setLastCollaboratorId(collaboratorId);
  }, [collaboratorId, collaborators, lastCollaboratorId, modalType]);

  useEffect(() => {
    if (modalType !== "collaborator_payment") return;
    const paymentForm = form as CollaboratorPaymentFormValues;
    const montoFinal = Math.max(
      0,
      paymentForm.montoBase + paymentForm.bono - paymentForm.descuento - paymentForm.devolucion,
    );
    if (paymentForm.montoFinal !== montoFinal) {
      setForm((prev) => ({
        ...prev,
        montoFinal,
      }));
    }
  }, [form, modalType]);

  const errors = useMemo(() => config.schema(form as never), [config, form]);
  const isValid = Object.keys(errors).length === 0;

  if (!isOpen) return null;

  const fields = config.fields({ collaborators }).filter((field) =>
    field.showWhen ? field.showWhen(form) : true,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{config.title}</h3>
            <p className="text-xs text-slate-500">{config.description}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
            onClick={() => {
              setForm(config.defaultValues);
              onClose();
            }}
            disabled={disabled}
          >
            Cancelar
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <Field key={field.name} label={field.label} fullWidth={field.type === "textarea"}>
              {renderField(field, form, setForm, disabled)}
              {errors[field.name] ? <ErrorText message={errors[field.name]} /> : null}
            </Field>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={() => {
              setForm(config.defaultValues);
              onClose();
            }}
            disabled={disabled}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
            onClick={() => {
              if (!isValid) return;
              onSubmit(modalType, form);
              setForm(config.defaultValues);
            }}
            disabled={disabled || !isValid}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <label className={fullWidth ? "flex flex-col gap-2 text-xs font-semibold text-slate-500 sm:col-span-2" : "flex flex-col gap-2 text-xs font-semibold text-slate-500"}>
      {label}
      {children}
    </label>
  );
}

function ErrorText({ message }: { message: string }) {
  return <span className="text-xs text-rose-600">{message}</span>;
}

function renderField(
  field: FinanceField,
  values: FinanceFormValuesMap[FinanceModalType],
  setValues: React.Dispatch<React.SetStateAction<FinanceFormValuesMap[FinanceModalType]>>,
  disabled?: boolean,
) {
  const baseClassName = "w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm";
  const value = values[field.name as keyof typeof values];

  if (field.type === "textarea") {
    return (
      <textarea
        className={baseClassName}
        rows={3}
        placeholder={field.placeholder}
        value={String(value ?? "")}
        onChange={(event) =>
          setValues((prev) => ({
            ...prev,
            [field.name]: event.target.value,
          }))
        }
        disabled={disabled}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        className="h-4 w-4 rounded border border-slate-300"
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) =>
          setValues((prev) => ({
            ...prev,
            [field.name]: event.target.checked,
          }))
        }
        disabled={disabled}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        className={baseClassName}
        value={String(value ?? "")}
        onChange={(event) =>
          setValues((prev) => ({
            ...prev,
            [field.name]: event.target.value,
          }))
        }
        disabled={disabled}
      >
        <option value="">Selecciona</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <input
        className={baseClassName}
        type="number"
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        value={Number(value ?? 0)}
        onChange={(event) =>
          setValues((prev) => ({
            ...prev,
            [field.name]: event.target.value === "" ? 0 : Number(event.target.value),
          }))
        }
        readOnly={field.readOnly}
        disabled={disabled}
      />
    );
  }

  return (
    <input
      className={baseClassName}
      type={field.type}
      placeholder={field.placeholder}
      value={String(value ?? "")}
      onChange={(event) =>
        setValues((prev) => ({
          ...prev,
          [field.name]: event.target.value,
        }))
      }
      disabled={disabled}
    />
  );
}
