"use client";

import Link from "next/link";
import { ReactNode } from "react";

export function Logo({ inverted = false }: { inverted?: boolean } = {}) {
  return (
    <Link
      href="/"
      className={`font-display font-extrabold text-lg tracking-tight ${inverted ? "text-white" : "text-ink"}`}
    >
      Nit<span className="text-gradient">ido</span>
    </Link>
  );
}

export function Button({
  children,
  onClick,
  variant = "solid",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "px-5 py-3 rounded-full font-display font-bold text-sm transition-all duration-200 " +
    "disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96]";
  const styles =
    variant === "solid"
      ? "btn-aurora text-white hover:-translate-y-0.5"
      : variant === "ghost"
        ? "text-ink hover:bg-ink/5"
        : "bg-white border border-line text-ink shadow-[0_1px_2px_rgba(20,37,48,0.04)] " +
          "hover:border-aqua hover:shadow-[0_4px_16px_-4px_rgba(20,37,48,0.12)] hover:-translate-y-0.5";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  glass = false,
}: {
  children: ReactNode;
  className?: string;
  glass?: boolean;
}) {
  if (glass) {
    return (
      <div className={`glass border-gradient rounded-3xl p-6 shadow-[0_8px_40px_-12px_rgba(20,37,48,0.25)] ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <div
      className={`bg-white border border-line rounded-2xl p-6 shadow-[0_1px_2px_rgba(20,37,48,0.04),0_8px_24px_-12px_rgba(20,37,48,0.12)] transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(20,37,48,0.05),0_12px_32px_-12px_rgba(20,37,48,0.16)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3.5 py-2.5 border border-line rounded-xl text-sm text-ink bg-white transition-all duration-150 " +
  "focus:outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/15 hover:border-ink/20";

export function StatusTrack({
  steps,
}: {
  steps: { label: string; done: boolean }[];
}) {
  return (
    <div className="bg-mist rounded-xl p-4 mt-4">
      {steps.map((s, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 py-2 text-sm ${
            s.done ? "text-ink font-semibold" : "text-muted"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${s.done ? "bg-aqua" : "bg-line"}`}
          />
          {s.label}
        </div>
      ))}
    </div>
  );
}

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 justify-center my-4">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`text-3xl leading-none transition ${
            v <= value ? "text-coral" : "text-line"
          }`}
          aria-label={`${v} stele`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
