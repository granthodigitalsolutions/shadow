import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'motion/react';

export default function AnimatedCounter({ value, className }: { value: string, className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const hasPlus = value.includes('+');
  const numValue = parseInt(value.replace(/,/g, '').replace('+', ''));
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (inView && !isNaN(numValue)) {
      const controls = animate(count, numValue, { duration: 2, ease: "easeOut" });
      return controls.stop;
    }
  }, [inView, numValue, count]);

  if (isNaN(numValue)) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span ref={ref} className={className}>
      <motion.span>{rounded}</motion.span>
      {hasPlus && '+'}
    </span>
  );
}
