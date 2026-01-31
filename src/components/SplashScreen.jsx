import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onComplete, isOffline = false, loadingProgress = 0, isReady = false }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const [offline, setOffline] = useState(!navigator.onLine || isOffline);

    // Update progress when loadingProgress prop changes
    useEffect(() => {
        // Always update progress, even if it's 0 (to show initial state)
        setProgress(Math.min(100, Math.max(0, loadingProgress)));
    }, [loadingProgress]);

    useEffect(() => {
        // Listen for online/offline events
        const handleOnline = () => {
            setOffline(false);
        };
        
        const handleOffline = () => {
            setOffline(true);
            setIsVisible(true); // Keep showing splash if offline
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Handle completion when ready
    useEffect(() => {
        if (isReady && !offline && progress >= 100) {
            // Wait a bit to show 100% before fading out
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => {
                    onComplete?.();
                }, 500);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isReady, offline, progress, onComplete]);

    // Simulate progress if not provided (fallback) - only if progress hasn't updated after 1 second
    useEffect(() => {
        if (!isOffline && loadingProgress === 0 && progress === 0) {
            // Wait 1 second to see if real progress comes in
            const timeout = setTimeout(() => {
                // Only start simulation if still at 0 after 1 second
                if (loadingProgress === 0 && progress === 0) {
                    let currentProgress = 0;
                    const interval = setInterval(() => {
                        currentProgress += 2;
                        if (currentProgress >= 100) {
                            currentProgress = 100;
                            clearInterval(interval);
                            setProgress(100);
                            // If ready, complete after showing 100%
                            if (isReady) {
                                setTimeout(() => {
                                    setIsVisible(false);
                                    setTimeout(() => {
                                        onComplete?.();
                                    }, 500);
                                }, 500);
                            }
                        } else {
                            setProgress(currentProgress);
                        }
                    }, 50);
                    return () => clearInterval(interval);
                }
            }, 1000);
            return () => clearTimeout(timeout);
        }
    }, [isOffline, loadingProgress, isReady, onComplete, progress]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                    }}
                >
                    {/* Background overlay */}
                    <div className="absolute inset-0 bg-black/40"></div>
                    
                    {/* Loading box */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full mx-4"
                    >
                        {/* Logo */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="flex justify-center mb-6"
                        >
                            <img 
                                src="/logo.jpg" 
                                alt="X TradingAI Logo" 
                                className="h-16 md:h-20 w-auto"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    const fallback = e.target.nextElementSibling;
                                    if (fallback) {
                                        fallback.classList.remove('hidden');
                                    }
                                }}
                            />
                            {/* Fallback text logo */}
                            <div className="hidden text-2xl md:text-3xl font-bold text-gray-900">
                                <span className="text-teal-500">X</span>
                                <span className="text-red-500">TradingAI</span>
                            </div>
                        </motion.div>

                        {/* Welcome message */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="text-center mb-6"
                        >
                            <p className="text-gray-700 text-sm md:text-base">
                                Welcome to X TradingAI, Your Trusted and Approved Deriv Third Party Application
                            </p>
                        </motion.div>

                        {/* Syncing message */}
                        {!offline && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                                className="text-center mb-4"
                            >
                                <p className="text-gray-600 text-sm">Syncing strategies...</p>
                            </motion.div>
                        )}

                        {/* Offline message */}
                        {offline && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                                className="text-center mb-4"
                            >
                                <p className="text-red-600 text-sm">No Internet Connection</p>
                                <p className="text-gray-500 text-xs mt-1">Please check your connection</p>
                            </motion.div>
                        )}

                        {/* Progress bar */}
                        {!offline && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                                className="mb-2"
                            >
                                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                                    />
                                </div>
                                <div className="text-center mt-2">
                                    <span className="text-blue-600 font-semibold text-sm">{Math.round(progress)}%</span>
                                </div>
                            </motion.div>
                        )}

                        {/* Copyright */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6, duration: 0.5 }}
                            className="text-center mt-6"
                        >
                            <p className="text-gray-500 text-xs">
                                © {new Date().getFullYear()} X TradingAI. All rights reserved.
                            </p>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
