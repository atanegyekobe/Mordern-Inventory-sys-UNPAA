"use client";

import { type SyntheticEvent, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Scene from "./Scene";

const HERO_VIDEO_PLAYLIST = process.env.NEXT_PUBLIC_HERO_VIDEO_PLAYLIST
  ? process.env.NEXT_PUBLIC_HERO_VIDEO_PLAYLIST.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  : [];

const HERO_VIDEOS =
  HERO_VIDEO_PLAYLIST.length > 0
    ? HERO_VIDEO_PLAYLIST
    : [
        process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "/media/hero-visual.mp4",
        "/media/hero-visual-2.mp4","/media/hero-visual-3.mp4",
      ];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function Hero() {
  const [showSceneFallback, setShowSceneFallback] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [failedVideoIndexes, setFailedVideoIndexes] = useState<number[]>([]);

  const getNextPlayableIndex = (startIndex: number, blockedIndexes: number[]) => {
    if (HERO_VIDEOS.length === 0) {
      return null;
    }

    for (let step = 1; step <= HERO_VIDEOS.length; step += 1) {
      const candidate = (startIndex + step) % HERO_VIDEOS.length;
      if (!blockedIndexes.includes(candidate)) {
        return candidate;
      }
    }

    return null;
  };

  const handleVideoError = () => {
    setFailedVideoIndexes((previous) => {
      const nextFailed = previous.includes(activeVideoIndex)
        ? previous
        : [...previous, activeVideoIndex];

      const nextIndex = getNextPlayableIndex(activeVideoIndex, nextFailed);
      if (nextIndex === null) {
        setShowSceneFallback(true);
        return nextFailed;
      }

      setActiveVideoIndex(nextIndex);
      return nextFailed;
    });
  };

  const handleVideoEnded = (event: SyntheticEvent<HTMLVideoElement>) => {
    const playableCount = HERO_VIDEOS.length - failedVideoIndexes.length;
    if (playableCount <= 1) {
      event.currentTarget.currentTime = 0;
      void event.currentTarget.play().catch(() => {});
      return;
    }

    const nextIndex = getNextPlayableIndex(activeVideoIndex, failedVideoIndexes);
    if (nextIndex === null) {
      setShowSceneFallback(true);
      return;
    }

    setActiveVideoIndex(nextIndex);
  };

  const activeVideoSrc = HERO_VIDEOS[activeVideoIndex];
  const playableVideoCount = HERO_VIDEOS.length - failedVideoIndexes.length;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-rose-50/60 via-amber-50/40 to-cyan-50/50" />
      <div className="absolute inset-0 grid-overlay opacity-40" />
      <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="absolute bottom-0 left-8 h-80 w-80 rounded-full bg-rose-300/30 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/75"
          >
            Elevated essentials
          </motion.p>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl font-semibold leading-tight tracking-tight md:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Register today to showcase and manage your products.
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-xl text-lg text-black/70"
          >
            Launch your own shop. Showcase your products with a modern touch and manage everything from one powerful dashboard.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              href="/shop"
              className="rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-orange-600"
            >
              Explore the shop
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-black/15 bg-white/80 px-6 py-3 text-sm font-semibold transition hover:border-black/30 hover:bg-black/5"
            >
              Preview admin suite
            </Link>
          </motion.div>
        </div>
        <div className="relative">
          <div className="absolute -left-6 top-8 h-64 w-64 rounded-4xl border border-rose-200/70 bg-white/50 blur-[1px]" />
          <div className="absolute bottom-12 right-4 h-40 w-40 rounded-[28px] border border-cyan-200/70 bg-white/55 blur-[1px]" />
          <div className="relative h-105 overflow-hidden rounded-[36px] border border-black/10 bg-white/65 shadow-[0_28px_55px_-36px_rgba(0,0,0,0.45)]">
            {showSceneFallback || !activeVideoSrc ? (
              <Scene />
            ) : (
              <video
                key={activeVideoSrc}
                src={activeVideoSrc}
                autoPlay
                muted
                loop={playableVideoCount <= 1}
                playsInline
                preload="metadata"
                onError={handleVideoError}
                onEnded={handleVideoEnded}
                className="h-full w-full object-cover"
                aria-label="Hero visual video"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
