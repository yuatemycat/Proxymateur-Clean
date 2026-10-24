import React from 'react';
import { ProxyMonitor } from '../components/proxy/ProxyMonitor';

const Monitor: React.FC = () => {
    return (
        <div className="h-full flex flex-col p-6 w-full">
            <ProxyMonitor className="flex-1" />
        </div>
    );
};

export default Monitor;
