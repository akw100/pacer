import { motion, useScroll, type HTMLMotionProps } from "motion/react";

import { cn } from "@/lib/utils";

export function ScrollProgress({
  className,
  ...props
}: HTMLMotionProps<"div">) {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-px origin-left bg-linear-to-r from-[#FF5A36] via-[#F5A623] to-[#52A869]",
        className,
      )}
      style={{
        scaleX: scrollYProgress,
      }}
      {...props}
    />
  );
}
