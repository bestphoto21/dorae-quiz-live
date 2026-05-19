"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/admin/login/actions";

const initialState: LoginActionState = {
  message: null,
};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-8 grid gap-5">
      <div>
        <label
          htmlFor="email"
          className="text-sm font-black uppercase text-slate-500"
        >
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-lg font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400"
          placeholder="admin@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-sm font-black uppercase text-slate-500"
        >
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-lg font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400"
          placeholder="비밀번호"
        />
      </div>

      {state.message && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
