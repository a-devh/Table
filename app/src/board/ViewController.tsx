// The table "camera" controls: zoom and fit-all.
import { useTable } from '../model/store';
import { CARD_HEIGHT, CARD_WIDTH } from '../model/derived';
import { FitIcon } from '../app/icons';
import ui from '../app/ui.module.css';

function boardCenter() {
  const el = document.getElementById('board');
  return el ? { x: el.clientWidth / 2, y: el.clientHeight / 2, w: el.clientWidth, h: el.clientHeight } : { x: 0, y: 0, w: 0, h: 0 };
}

export function ViewController() {
  const zoom = useTable((s) => s.camera.zoom);
  const zoomAt = useTable((s) => s.zoomAt);

  const fitAll = () => {
    const { cards, fences } = useTable.getState();
    const boxes = [
      ...Object.values(cards).map((c) => ({ x: c.x, y: c.y, w: CARD_WIDTH, h: CARD_HEIGHT })),
      ...Object.values(fences).map((f) => ({ x: f.x, y: f.y, w: f.width, h: f.height })),
    ];
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const view = boardCenter();
    const pad = 80;
    const z = Math.min(3, Math.max(0.2, Math.min((view.w - pad * 2) / (maxX - minX), (view.h - pad * 2) / (maxY - minY))));
    useTable.setState({
      camera: { zoom: z, x: view.w / 2 - ((minX + maxX) / 2) * z, y: view.h / 2 - ((minY + maxY) / 2) * z },
    });
  };

  return (
    <div role="toolbar" aria-label="Zoom" className={ui.bubbleBottom}>
      <button aria-label="Zoom out" className={ui.iconButton} onClick={() => zoomAt(1 / 1.2, boardCenter().x, boardCenter().y)}>
        −
      </button>
      <span style={{ width: 44, textAlign: 'center', fontSize: 12 }}>{Math.round(zoom * 100)}%</span>
      <button aria-label="Zoom in" className={ui.iconButton} onClick={() => zoomAt(1.2, boardCenter().x, boardCenter().y)}>
        +
      </button>
      <button aria-label="Fit all cards" className={ui.iconButton} onClick={fitAll}>
        <FitIcon />
      </button>
    </div>
  );
}
