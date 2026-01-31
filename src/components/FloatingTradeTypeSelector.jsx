import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TradeTypeSelector from '@/components/TradeTypeSelector';

const FloatingTradeTypeSelector = ({
                                       isOpen,
                                       onClose,
                                       selectedType,
                                       onSelectType,
                                       selectedMarket,
                                       aiPrediction
                                   }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0  z-40"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{
                            x: '100%',
                            y: '',
                            scale: 0.9,
                            opacity: 0
                        }}
                        animate={{
                            x: '-400px',
                            y: '',
                            scale: 1,
                            opacity: 1
                        }}
                        exit={{
                            x: '100%',
                            y: '',
                            scale: 0.9,
                            opacity: 0
                        }}
                        transition={{
                            type: 'spring',
                            damping: 25,
                            stiffness: 300
                        }}
                        className="absolute right-0  md:right-80 top-1/2 transform -translate-y-1/2 w-[500px] h-[720px] bg-white rounded-l-2xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden"
                        style={{ marginRight: '20px' }}
                    >
                        <TradeTypeSelector
                            selectedType={selectedType}
                            onSelectType={onSelectType}
                            onBack={onClose}
                            selectedMarket={selectedMarket}
                            aiPrediction={aiPrediction}
                            isCompact={true}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default FloatingTradeTypeSelector;