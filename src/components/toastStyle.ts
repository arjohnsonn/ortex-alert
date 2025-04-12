const toastStyle = () => {
  return `
      /* Toast container */
      #options-flow-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 320px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        pointer-events: auto;
        scrollbar-width: thin;
        padding-right: 5px;
      }

      /* For webkit browsers */
      #options-flow-toast-container::-webkit-scrollbar {
        width: 6px;
      }

      #options-flow-toast-container::-webkit-scrollbar-track {
        background: transparent;
      }

      #options-flow-toast-container::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }

      /* Toast notification */
      .options-flow-toast {
        background-color: white;
        color: #333;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: options-flow-toast-slide-in 0.2s ease-out;
        border-left: 4px solid #6366f1;
        max-width: 100%;
        pointer-events: auto;
        font-size: 13px;
      }

      .options-flow-toast.call {
        border-left-color: #10b981;
      }

      .options-flow-toast.put {
        border-left-color: #ef4444;
      }

      .options-flow-toast.dark-mode {
        background-color: #2a2a2a;
        color: #f5f5f5;
        border-color: #4b5563;
      }

      .options-flow-toast-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px 6px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }

      .options-flow-toast.dark-mode .options-flow-toast-header {
        border-bottom-color: rgba(255, 255, 255, 0.1);
      }

      .options-flow-toast-title {
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .options-flow-toast-badge {
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 10px;
        background-color: #f3f4f6;
        color: #4b5563;
      }

      .options-flow-toast.dark-mode .options-flow-toast-badge {
        background-color: #374151;
        color: #d1d5db;
      }

      .options-flow-toast-close {
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
        font-size: 18px;
        padding: 0;
        margin-left: 8px;
      }

      .options-flow-toast.dark-mode .options-flow-toast-close {
        color: #d1d5db;
      }

      .options-flow-toast-content {
        padding: 8px 12px;
      }

      .options-flow-toast-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 3px;
      }

      .options-flow-toast-volume {
        font-weight: bold;
      }

      .options-flow-toast-footer {
        display: flex;
        justify-content: space-between;
        padding: 6px 12px 8px;
        font-size: 11px;
        color: #666;
      }

      .options-flow-toast.dark-mode .options-flow-toast-footer {
        color: #9ca3af;
      }

      .options-flow-toast-action {
        background-color: #f3f4f6;
        border: none;
        border-radius: 4px;
        padding: 3px 10px;
        font-size: 11px;
        cursor: pointer;
        margin-left: 8px;
        transition: background-color 0.2s;
      }

      .options-flow-toast-action:hover {
        background-color: #e5e7eb;
      }

      .options-flow-toast.dark-mode .options-flow-toast-action {
        background-color: #374151;
        color: #f3f4f6;
      }

      .options-flow-toast.dark-mode .options-flow-toast-action:hover {
        background-color: #4b5563;
      }

      .options-flow-toast .call-text {
        color: #10b981;
      }

      .options-flow-toast .put-text {
        color: #ef4444;
      }

      .options-flow-toast .flex-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Debug Button Styles */
      #options-flow-debug-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4f46e5;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 14px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      }

      #options-flow-debug-button:hover {
        background-color: #4338ca;
      }

      @keyframes options-flow-toast-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes options-flow-toast-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      .options-flow-toast.removing {
        animation: options-flow-toast-slide-out 0.2s ease-in forwards;
      }
    `;
};

export default toastStyle;
