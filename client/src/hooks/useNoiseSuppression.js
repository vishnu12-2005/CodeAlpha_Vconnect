import { useRef, useEffect } from 'react';

export function useNoiseSuppression() {
  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const filterNodeRef = useRef(null);
  const gateNodeRef = useRef(null);
  const destinationNodeRef = useRef(null);

  const applyNoiseSuppression = (stream) => {
    if (!stream || stream.getAudioTracks().length === 0) return null;

    try {
      // Create Audio Context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const audioTrack = stream.getAudioTracks()[0];
      const sourceStream = new MediaStream([audioTrack]);
      
      // Source node
      const sourceNode = audioCtx.createMediaStreamSource(sourceStream);
      sourceNodeRef.current = sourceNode;

      // 1. Highpass filter to cut out low frequency hums (like fans)
      const filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'highpass';
      filterNode.frequency.setValueAtTime(150, audioCtx.currentTime); // Cut below 150Hz
      filterNodeRef.current = filterNode;

      // 2. Dynamics Compressor acting as a Noise Gate
      const gateNode = audioCtx.createDynamicsCompressor();
      gateNode.threshold.setValueAtTime(-45, audioCtx.currentTime); // Mute anything quieter than -45dB
      gateNode.knee.setValueAtTime(10, audioCtx.currentTime);
      gateNode.ratio.setValueAtTime(12, audioCtx.currentTime);
      gateNode.attack.setValueAtTime(0.02, audioCtx.currentTime); // Fast attack
      gateNode.release.setValueAtTime(0.20, audioCtx.currentTime); // Fast release
      gateNodeRef.current = gateNode;

      // 3. Destination node
      const destinationNode = audioCtx.createMediaStreamDestination();
      destinationNodeRef.current = destinationNode;

      // Connect graph: Source -> Highpass -> Noise Gate -> Destination
      sourceNode.connect(filterNode);
      filterNode.connect(gateNode);
      gateNode.connect(destinationNode);

      // Return the processed audio track in a new stream
      const processedTrack = destinationNode.stream.getAudioTracks()[0];
      return processedTrack;
    } catch (error) {
      console.error('Failed to initialize Web Audio noise suppression:', error);
      return null;
    }
  };

  const cleanup = () => {
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (filterNodeRef.current) filterNodeRef.current.disconnect();
    if (gateNodeRef.current) gateNodeRef.current.disconnect();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
  };

  useEffect(() => {
    return cleanup;
  }, []);

  return {
    applyNoiseSuppression,
    cleanupAudioGraph: cleanup
  };
}
