"use client"

import { useRef, useState, ReactNode, MouseEvent } from "react"
import { motion, type Transition } from "framer-motion"

interface MagneticButtonProps {
    children: ReactNode
    className?: string
    href?: string
    onClick?: () => void
}

export function MagneticButton({ children, className, href, onClick }: MagneticButtonProps) {
    const ref = useRef<HTMLAnchorElement | HTMLDivElement>(null)
    const [position, setPosition] = useState({ x: 0, y: 0 })

    const handleMouse = (e: MouseEvent) => {
        if (!ref.current) return
        const { clientX, clientY } = e
        const { left, top, width, height } = ref.current.getBoundingClientRect()
        setPosition({
            x: (clientX - left - width / 2) * 0.15,
            y: (clientY - top - height / 2) * 0.15
        })
    }

    const transition: Transition = { type: "spring", stiffness: 150, damping: 15 }

    const commonProps = {
        className,
        onMouseMove: handleMouse,
        onMouseLeave: () => setPosition({ x: 0, y: 0 }),
        animate: { x: position.x, y: position.y },
        transition
    }

    if (href) {
        return (
            <motion.a
                ref={ref as React.RefObject<HTMLAnchorElement>}
                href={href}
                {...commonProps}
            >
                {children}
            </motion.a>
        )
    }

    return (
        <motion.div
            ref={ref as React.RefObject<HTMLDivElement>}
            onClick={onClick}
            {...commonProps}
        >
            {children}
        </motion.div>
    )
}
