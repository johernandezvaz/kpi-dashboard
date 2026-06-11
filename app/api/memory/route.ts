import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const memory = process.memoryUsage();

        const stats = {
            pid: process.pid,
            uptimeSeconds: Math.round(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: {
                rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
                arrayBuffers: `${(memory.arrayBuffers / 1024 / 1024).toFixed(2)} MB`
            }
        };

        console.log('\n===== MEMORY USAGE REPORT =====');
        console.log(`Process ID (PID): ${stats.pid}`);
        console.log(`Uptime:           ${stats.uptimeSeconds}s`);
        console.log(`Node Version:     ${stats.nodeVersion}`);
        console.log(`RSS:              ${stats.memory.rss}`);
        console.log(`Heap Total:       ${stats.memory.heapTotal}`);
        console.log(`Heap Used:        ${stats.memory.heapUsed}`);
        console.log(`External:         ${stats.memory.external}`);
        console.log(`Array Buffers:    ${stats.memory.arrayBuffers}`);
        console.log('===============================\n');

        return NextResponse.json(stats);
    } catch (error: any) {
        console.error('Error fetching memory stats:', error);
        return NextResponse.json(
            { error: error?.message || 'Error fetching memory stats' },
            { status: 500 }
        );
    }
}
