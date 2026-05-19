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
          className="text-sm font-black text-slate-700"
        >
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-2xl border border-slate-400 bg-white px-5 py-4 text-lg font-bold text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
          placeholder="admin@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-sm font-black text-slate-700"
        >
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-2xl border border-slate-400 bg-white px-5 py-4 text-lg font-bold text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
          placeholder="비밀번호"
        />
      </div>

      {state.message && (
        <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-[#10284f] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
      >
        {isPending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
