import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface AnalysisStatusMessage {
  type: 'analysis_status';
  analysis_id: number;
  status: string;
  error_message?: string;
}

type WSMessage = AnalysisStatusMessage | { type: 'pong' };

export function useProjectWebSocket(projectId: number | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!projectId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/projects/${projectId}`;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === 'analysis_status') {
            // Invalidate analysis queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
            if (msg.status === 'completed' || msg.status === 'failed') {
              queryClient.invalidateQueries({ queryKey: ['analysis', msg.analysis_id] });
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [projectId, queryClient]);
}
