"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import {
  formatDuration,
  formatIst,
  formatRemaining,
  getValidityStatus,
  hasValidity,
  isJoinBlocked,
  useNow,
} from "../../lib/groupValidity";

type Group = {
  id: string;
  title: string;
  city: string;
  interest: string;
  area?: string | null;
  description: string;
  platforms: string[];
  poster_url?: string | null;
  validity_enabled?: boolean | null;
  start_at?: string | null;
  expires_at?: string | null;
};

export default function RingDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      setGroup((data as any) || null);
    }

    load();
  }, [id]);

  // Group Validity: ticks only when the group has validity enabled
  const validityOn = hasValidity(group);
  const now = useNow(validityOn ? 1000 : 0);

  if (!group) return null;

  const status = getValidityStatus(group, now);
  const joinBlocked = isJoinBlocked(status);

  return (
    <main className="min-h-screen text-white">

      {/* SAME BACKGROUND */}
      <div className="fixed inset-0 -z-10 bg-[#07070A]">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_80%_30%,rgba(255,255,255,0.08),transparent_55%)]" />
      </div>
       


      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        <a href="/join" className="text-sm text-white/70 hover:text-white">
          ← Back to Join
        </a>


        <h1 className="mt-6 text-4xl font-semibold">
          {group.title}
        </h1>


        {/* SAME PREMIUM CARD */}
        <div className="mt-10 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">


          {/* POSTER — NO EXTRA SPACE */}
          {group.poster_url && (

            <div className="flex justify-center">

              <img
                src={group.poster_url}
                alt={group.title}
                className="max-w-md w-full h-auto object-contain"
                loading="lazy"
              />

            </div>

          )}



          <div className="p-6">

            {/* DESCRIPTION MOVED HERE - BELOW POSTER */}
            <p className="text-white/70">
              {group.description}
            </p>


            <h2 className="mt-8 text-xl font-semibold">
              About this ring
            </h2>


            <div className={`mt-6 grid gap-4 ${group.area ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>

              <InfoCard title="Interest" value={group.interest} />

              <InfoCard title="City" value={group.city} />

              {group.area ? (
                <div className="col-span-2 sm:col-span-1">
                  <InfoCard title="Area" value={group.area} />
                </div>
              ) : null}

            </div>


            {/* GROUP VALIDITY — only rendered when validity is enabled */}
            {status && (
              <ValidityCard
                status={status}
                startAt={group.start_at as string}
                expiresAt={group.expires_at as string}
                now={now}
              />
            )}


            <div className="mt-8 max-w-sm">

              <button
                onClick={() => {
                  if (joinBlocked) return;
                  window.location.href = `/ring/${group.id}/join`;
                }}
                disabled={joinBlocked}
                className={
                  joinBlocked
                    ? "w-full px-4 sm:px-6 py-4 rounded-2xl bg-white/10 border border-white/10 text-white/50 cursor-not-allowed"
                    : "w-full px-4 sm:px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500"
                }
              >
                {status === "expired"
                  ? "Group Expired"
                  : status === "upcoming"
                  ? "Not Open Yet"
                  : "Join Now"}
              </button>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}


function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs text-white/60">{title}</div>
      <div className="mt-2 font-semibold">{value}</div>
    </div>
  );
}


const STATUS_STYLES = {
  upcoming: {
    label: "UPCOMING",
    dot: "bg-sky-400",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  },
  active: {
    label: "ACTIVE",
    dot: "bg-emerald-400",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  expiring_soon: {
    label: "EXPIRING SOON",
    dot: "bg-amber-400",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  expired: {
    label: "EXPIRED",
    dot: "bg-red-400",
    badge: "border-red-400/30 bg-red-400/10 text-red-300",
  },
} as const;

function ValidityCard({
  status,
  startAt,
  expiresAt,
  now,
}: {
  status: "upcoming" | "active" | "expiring_soon" | "expired";
  startAt: string;
  expiresAt: string;
  now: number;
}) {
  const st = STATUS_STYLES[status];
  const duration = formatDuration(startAt, expiresAt);
  const remainingMs = new Date(expiresAt).getTime() - now;
  const untilStartMs = new Date(startAt).getTime() - now;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${st.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
        {duration && (
          <span className="text-xs text-white/60">
            Duration: <span className="font-semibold text-white/80">{duration}</span>
          </span>
        )}
      </div>

      <div className="mt-4">
        {status === "upcoming" && (
          <>
            <div className="text-xs text-white/60">Starts on</div>
            <div className="mt-1 font-semibold">{formatIst(startAt)}</div>
            <div className="mt-1 text-xs text-white/50">Opens in {formatRemaining(untilStartMs)}</div>
          </>
        )}

        {(status === "active" || status === "expiring_soon") && (
          <>
            <div className="text-xs text-white/60">Expires in</div>
            <div className="mt-1 font-semibold">{formatRemaining(remainingMs)}</div>
            <div className="mt-1 text-xs text-white/50">Valid until {formatIst(expiresAt)}</div>
          </>
        )}

        {status === "expired" && (
          <>
            <div className="text-xs text-white/60">Expired on</div>
            <div className="mt-1 font-semibold">{formatIst(expiresAt)}</div>
            <div className="mt-1 text-xs text-white/50">This ring is no longer accepting join requests.</div>
          </>
        )}
      </div>
    </div>
  );
}
