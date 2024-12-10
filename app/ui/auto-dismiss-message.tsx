'use client';

import { useEffect, useState } from "react";

export default function AutoDismiss(
    { duration, message, color }: { duration: number, message: string, color: string }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
        },
            duration);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className={`
                fixed top-8 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                bg-${color}-500 text-white rounded shadow-md 
                py-2 px-4 
                transition-opacity duration-500 
                ${visible ? "opacity-100" : "opacity-0"
                }`}
        >
            {message}
        </div>
    );
}
