import { motion, AnimatePresence } from "framer-motion";

export const Loader = ({ started, onStarted, progress }) => {
  return (
    <AnimatePresence>
      {!started && (
        <motion.div
          className="loader-container"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.5, ease: "easeInOut" } }}
          style={{
            pointerEvents: progress === 100 ? 'auto' : 'none', // Only catch clicks when button is ready
            background: 'transparent',
            zIndex: 9999, // Always on top but invisible/non-blocking until ready
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="loader-content" style={{ position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)' }}>
            {progress === 100 && (
              <motion.button
                className="enter-button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1, backgroundColor: "#00ff88", color: "#000" }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  console.log("ACCESS CORE CLICKED");
                  onStarted();
                }}
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '2px solid #00ff88',
                  color: '#00ff88',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  boxShadow: '0 0 15px #00ff88'
                }}
              >
                ACCESS CORE
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
