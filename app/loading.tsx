import Image from "next/image"

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        <div className="relative w-32 h-32 mb-6">
          <Image
            src="/logo.png"
            alt="NEON SYSTEM"
            fill
            className="object-contain"
            sizes="128px"
            priority
          />
        </div>
        <div className="w-24 h-[3px] bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full animate-pulse" />
      </div>
    </div>
  )
}
