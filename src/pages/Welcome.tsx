import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo.jpg";

const Sparkle = ({ delay, x, y }: { delay: number; x: string; y: string }) => (
  <motion.div
    className="absolute text-primary"
    style={{ left: x, top: y }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 2,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  >
    <Sparkles className="w-4 h-4 md:w-6 md:h-6" />
  </motion.div>
);

const FloatingBox = ({ delay, x, size }: { delay: number; x: string; size: string }) => (
  <motion.div
    className="absolute opacity-20"
    style={{ left: x }}
    initial={{ y: "100vh", rotate: 0 }}
    animate={{
      y: "-100px",
      rotate: 360,
    }}
    transition={{
      duration: 15,
      delay,
      repeat: Infinity,
      ease: "linear",
    }}
  >
    <Package className={`${size} text-primary`} />
  </motion.div>
);

export default function Welcome() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleEnter = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-welcome relative overflow-hidden">
      {/* Floating boxes background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingBox delay={0} x="10%" size="w-8 h-8" />
        <FloatingBox delay={3} x="25%" size="w-6 h-6" />
        <FloatingBox delay={6} x="40%" size="w-10 h-10" />
        <FloatingBox delay={9} x="60%" size="w-7 h-7" />
        <FloatingBox delay={2} x="75%" size="w-9 h-9" />
        <FloatingBox delay={5} x="90%" size="w-5 h-5" />
      </div>

      {/* Sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        <Sparkle delay={0} x="15%" y="20%" />
        <Sparkle delay={0.5} x="80%" y="15%" />
        <Sparkle delay={1} x="25%" y="70%" />
        <Sparkle delay={1.5} x="85%" y="60%" />
        <Sparkle delay={2} x="50%" y="25%" />
        <Sparkle delay={0.8} x="70%" y="80%" />
        <Sparkle delay={1.2} x="10%" y="50%" />
        <Sparkle delay={1.8} x="90%" y="40%" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo and title */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Logo icon */}
          <motion.div
            className="mb-6 inline-flex items-center justify-center"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="relative">
              <img 
                src={logoImage} 
                alt="Mao~Mao Store" 
                className="w-24 h-24 md:w-32 md:h-32 rounded-3xl shadow-card object-cover"
              />
              <motion.div
                className="absolute -top-2 -right-2"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>
            </div>
          </motion.div>

          {/* Store name */}
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <span className="bg-gradient-to-r from-pink to-lavender bg-clip-text text-transparent">
              Mao~Mao
            </span>
            <br />
            <span className="text-foreground/90">Store</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="text-lg md:text-xl text-foreground/70 mb-8 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Kelola bisnis blindbox Anda dengan mudah dan indah ✨
          </motion.p>

          {/* Enter button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            <Button
              onClick={handleEnter}
              size="lg"
              className="group bg-gradient-primary hover:opacity-90 text-white font-semibold px-8 py-6 text-lg rounded-2xl shadow-glow animate-pulse-glow transition-all duration-300 hover:scale-105"
            >
              Masuk ke Dashboard
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Bottom decorative element */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <p className="text-sm text-foreground/40">
            Blindbox Manager System
          </p>
        </motion.div>
      </div>
    </div>
  );
}
