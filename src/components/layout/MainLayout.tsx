import React, { useState } from 'react';
import { Sidebar, type ToolKey } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
    children: (activeTool: ToolKey) => React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [activeTool, setActiveTool] = useState<ToolKey>('background-remover');

    return (
        <div className="flex h-screen bg-background transition-theme">
            <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <Header currentTool={activeTool} />

                <main className="flex-1 overflow-auto p-6">
                    {children(activeTool)}
                </main>
            </div>
        </div>
    );
};
