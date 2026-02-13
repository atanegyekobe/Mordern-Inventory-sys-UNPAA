"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Scene from "./Scene";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-60" />
      <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-0 left-12 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
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
            Curated goods for modern storefronts.
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-xl text-lg text-black/70"
          >
            Ellora Supply pairs a cinematic shopping experience with a powerful
            admin suite. Manage inventory, track orders, and ship faster.
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
              className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/80"
            >
              Explore the shop
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-black/15 px-6 py-3 text-sm font-semibold transition hover:border-black/30"
            >
              Preview admin suite
            </Link>
          </motion.div>
        </div>
        <div className="relative">
          <div className="glass-panel absolute -left-6 top-8 h-64 w-64 rounded-[32px]" />
          <div className="glass-panel absolute bottom-12 right-4 h-40 w-40 rounded-[28px]" />
          <div className="glass-panel relative h-[420px] overflow-hidden rounded-[36px]">
            <Scene />
          </div>
        </div>
      </div>
    </section>
  );
}
