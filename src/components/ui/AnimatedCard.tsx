import { motion, type MotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

const animationProps: MotionProps = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.45 },
}

export function AnimatedCard({
  children,
  className,
  motionProps = animationProps,
}: {
  children: ReactNode
  className: string
  motionProps?: MotionProps
}) {
  return (
    <motion.div {...motionProps} className={className}>
      {children}
    </motion.div>
  )
}
