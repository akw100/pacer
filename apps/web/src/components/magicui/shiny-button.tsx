import React from "react"
import { motion, type HTMLMotionProps, type MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

const animationProps: MotionProps = {
  initial: { "--x": "100%", scale: 0.8 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.95 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5,
    },
  },
}

interface ShinyButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  children: React.ReactNode
  className?: string
  /** Shine / gradient color. Defaults to the Pacer accent (coral, #FF5A36). */
  color?: string
}

export const ShinyButton = React.forwardRef<
  HTMLButtonElement,
  ShinyButtonProps
>(({ children, className, color = "#FF5A36", ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      style={{ "--shiny-color": color } as React.CSSProperties}
      className={cn(
        "relative cursor-pointer rounded-lg border border-border px-6 py-2 font-medium backdrop-blur-xl transition-shadow duration-300 ease-in-out hover:shadow",
        className
      )}
      {...animationProps}
      {...props}
    >
      <span
        className="relative block size-full text-sm uppercase tracking-wide text-ink"
        style={{
          maskImage:
            "linear-gradient(-75deg,var(--shiny-color) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),var(--shiny-color) calc(var(--x) + 100%))",
        }}
      >
        {children}
      </span>
      <span
        style={{
          mask: "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
          WebkitMask:
            "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
          backgroundImage:
            "linear-gradient(-75deg,color-mix(in srgb, var(--shiny-color) 10%, transparent) calc(var(--x)+20%),color-mix(in srgb, var(--shiny-color) 50%, transparent) calc(var(--x)+25%),color-mix(in srgb, var(--shiny-color) 10%, transparent) calc(var(--x)+100%))",
        }}
        className="absolute inset-0 z-10 block rounded-[inherit] p-px"
      />
    </motion.button>
  )
})

ShinyButton.displayName = "ShinyButton"
