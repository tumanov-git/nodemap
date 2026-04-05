import { useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

const STORAGE_KEY = "ref1-ontology-board-reactflow-v1";

const kindMeta = {
  object: {
    label: "Объект",
    title: "Новый объект",
    description: "Сущность предметной области, которая участвует в модели.",
    hint: "Пациент, товар, заявка",
  },
  process: {
    label: "Процесс",
    title: "Новый процесс",
    description: "Операция, которая меняет состояние системы.",
    hint: "Прием, обработка, отгрузка",
  },
  resource: {
    label: "Ресурс",
    title: "Новый ресурс",
    description: "Исполнитель или ограниченный элемент системы.",
    hint: "Врач, оператор, касса",
  },
  event: {
    label: "Событие",
    title: "Новое событие",
    description: "Точка запуска или завершения изменения в модели.",
    hint: "Приход, отказ, завершение",
  },
  state: {
    label: "Состояние",
    title: "Новое состояние",
    description: "Текущее положение объекта или системы.",
    hint: "Ожидание, занят, свободен",
  },
};

const demoBoard = {
  nodes: [
    makeNode("node-patient", "object", { x: 40, y: 80 }, "Пациент", "Приходит за услугой и ожидает прием."),
    makeNode(
      "node-arrival",
      "event",
      { x: 40, y: 260 },
      "Приход пациента",
      "Событие, после которого пациент попадает в очередь.",
    ),
    makeNode(
      "node-queue",
      "state",
      { x: 350, y: 100 },
      "Ожидание в очереди",
      "Состояние пациента до начала обслуживания.",
    ),
    makeNode(
      "node-visit",
      "process",
      { x: 370, y: 320 },
      "Прием",
      "Процесс обслуживания пациента врачом.",
    ),
    makeNode("node-doctor", "resource", { x: 690, y: 220 }, "Врач", "Ресурс, который проводит обслуживание."),
  ],
  edges: [
    makeEdge("edge-1", "node-patient", "node-queue"),
    makeEdge("edge-2", "node-arrival", "node-queue"),
    makeEdge("edge-3", "node-queue", "node-visit"),
    makeEdge("edge-4", "node-doctor", "node-visit"),
  ],
};

const nodeTypes = {
  concept: ConceptNode,
};

export default function App() {
  const fileInputRef = useRef(null);
  const [initialBoard] = useState(() => loadBoard());
  const [nodes, setNodes, onNodesChange] = useNodesState(initialBoard.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialBoard.edges);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [statusText, setStatusText] = useState(
    "Перемещай карточки по доске, редактируй свойства справа и соединяй узлы между собой.",
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  function addNodeByKind(kind) {
    const meta = kindMeta[kind];
    const index = nodes.length;
    const id = `node-${crypto.randomUUID()}`;
    const nextNode = makeNode(
      id,
      kind,
      {
        x: 80 + (index % 3) * 250,
        y: 80 + Math.floor(index / 3) * 180,
      },
      meta.title,
      meta.description,
    );

    setNodes((current) => current.concat(nextNode));
    setSelectedNodeId(id);
    setStatusText(`Добавлена карточка "${meta.label}".`);
  }

  function updateSelectedNode(patch) {
    if (!selectedNodeId) {
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node,
      ),
    );
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) {
      setStatusText("Сначала выбери карточку, которую хочешь удалить.");
      return;
    }

    const title = selectedNode?.data.title ?? "Карточка";
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    );
    setSelectedNodeId(null);
    setStatusText(`Карточка "${title}" удалена.`);
  }

  function onConnect(params) {
    setEdges((current) =>
      addEdge(
        {
          ...params,
          id: `edge-${crypto.randomUUID()}`,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2.4, stroke: "#2d6770" },
        },
        current,
      ),
    );
    setStatusText("Связь создана. Нажми на линию, чтобы удалить ее.");
  }

  function onSelectionChange({ nodes: selectedNodes }) {
    const [firstNode] = selectedNodes;
    if (!firstNode) {
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId(firstNode.id);
    setStatusText("Карточка выбрана. Ее можно редактировать справа.");
  }

  function onEdgeClick(_, edge) {
    setEdges((current) => current.filter((item) => item.id !== edge.id));
    setStatusText("Связь удалена.");
  }

  function exportBoard() {
    const payload = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ontology-board.json";
    link.click();
    window.URL.revokeObjectURL(url);
    setStatusText("JSON экспортирован.");
  }

  async function importBoard(event) {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        throw new Error("wrong-shape");
      }

      setNodes(data.nodes);
      setEdges(data.edges);
      setSelectedNodeId(null);
      setStatusText("Доска импортирована из JSON.");
    } catch (error) {
      setStatusText("Не удалось импортировать файл. Проверь его структуру.");
    } finally {
      event.target.value = "";
    }
  }

  function resetBoard() {
    setNodes(structuredClone(demoBoard.nodes));
    setEdges(structuredClone(demoBoard.edges));
    setSelectedNodeId(null);
    setStatusText("Восстановлен демо-сценарий с очередью в поликлинике.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="panel brand-panel">
          <p className="eyebrow">Concept Canvas</p>
          <h1>Визуальная карта понятий</h1>
          <p className="muted">
            Простая рабочая доска для объектов, процессов, состояний и связей.
            Подходит для быстрых схем, сервисных сценариев и предметных карт.
          </p>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Добавить карточку</h2>
            <span className="badge">React Flow</span>
          </div>
          <div className="template-list">
            {Object.entries(kindMeta).map(([kind, meta]) => (
              <button
                key={kind}
                className={`template-card ${kind}`}
                onClick={() => addNodeByKind(kind)}
                type="button"
              >
                <strong>{meta.label}</strong>
                <span>{meta.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Работа с картой</h2>
          </div>
          <p className="muted small">
            Добавляй карточки слева, перемещай их по холсту и соединяй через точки
            на краях. Получится чистая карта сущностей и отношений без перегруженного
            интерфейса.
          </p>
        </div>
      </aside>

      <main className="workspace">
        <header className="toolbar">
          <div className="toolbar-group">
            <button className="action primary" onClick={() => addNodeByKind("object")} type="button">
              Новая карточка
            </button>
            <button className="action danger" onClick={deleteSelectedNode} type="button">
              Удалить выбранную
            </button>
          </div>
          <div className="toolbar-group">
            <button className="action" onClick={exportBoard} type="button">
              Экспорт JSON
            </button>
            <button className="action" onClick={() => fileInputRef.current?.click()} type="button">
              Импорт JSON
            </button>
            <button className="action" onClick={resetBoard} type="button">
              Загрузить пример
            </button>
            <input
              ref={fileInputRef}
              accept="application/json"
              hidden
              onChange={importBoard}
              type="file"
            />
          </div>
        </header>

        <section className="board-wrap">
          <div className="board-status">
            <span>{statusText}</span>
          </div>

          <div className="flow-canvas">
            <ReactFlow
              defaultEdgeOptions={{
                type: "smoothstep",
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { strokeWidth: 2.4, stroke: "#2d6770" },
              }}
              edges={edges}
              fitView
              minZoom={0.6}
              nodeTypes={nodeTypes}
              nodes={nodes}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              onEdgesChange={onEdgesChange}
              onNodesChange={onNodesChange}
              onPaneClick={() => setSelectedNodeId(null)}
              onSelectionChange={onSelectionChange}
            >
              <Background color="rgba(70, 50, 28, 0.15)" gap={22} size={1.3} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                pannable
                position="bottom-right"
                style={{
                  background: "rgba(255, 252, 247, 0.9)",
                  border: "1px solid rgba(72, 57, 38, 0.12)",
                }}
                zoomable
              />
              <Panel position="top-left">
                <div className="canvas-note">
                  Потяни связь от правой точки одной карточки к левой точке другой.
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </section>
      </main>

      <aside className="sidebar rightbar">
        <div className="panel">
          <div className="panel-heading">
            <h2>Свойства</h2>
            <span className="badge">
              {selectedNode ? kindMeta[selectedNode.data.kind].label : "Ничего не выбрано"}
            </span>
          </div>

          <label className="field">
            <span>Название</span>
            <input
              disabled={!selectedNode}
              onChange={(event) => updateSelectedNode({ title: event.target.value })}
              placeholder="Например, Пациент"
              type="text"
              value={selectedNode?.data.title ?? ""}
            />
          </label>

          <label className="field">
            <span>Тип</span>
            <select
              disabled={!selectedNode}
              onChange={(event) => updateSelectedNode({ kind: event.target.value })}
              value={selectedNode?.data.kind ?? "object"}
            >
              {Object.entries(kindMeta).map(([kind, meta]) => (
                <option key={kind} value={kind}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Описание</span>
            <textarea
              disabled={!selectedNode}
              onChange={(event) => updateSelectedNode({ description: event.target.value })}
              placeholder="Коротко опиши роль понятия в модели."
              rows="5"
              value={selectedNode?.data.description ?? ""}
            />
          </label>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Навигация</h2>
          </div>
          <p className="muted small">
            Колесо мыши меняет масштаб, перетаскивание двигает холст, мини-карта
            помогает быстро переходить между областями схемы.
          </p>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Данные</h2>
          </div>
          <p className="muted small">
            Состояние доски сохраняется локально в браузере. Для обмена можно
            экспортировать схему в JSON и загрузить ее обратно позже.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ConceptNode({ data, selected }) {
  return (
    <div className={`concept-node ${data.kind} ${selected ? "selected" : ""}`}>
      <Handle className="concept-handle" position={Position.Left} type="target" />
      <div className="node-type-chip">{kindMeta[data.kind].label}</div>
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <Handle className="concept-handle" position={Position.Right} type="source" />
    </div>
  );
}

function makeNode(id, kind, position, title, description) {
  return {
    id,
    type: "concept",
    position,
    data: {
      kind,
      title,
      description,
    },
  };
}

function makeEdge(id, source, target) {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2.4, stroke: "#2d6770" },
  };
}

function loadBoard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(demoBoard);
    }

    const parsed = JSON.parse(raw);
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : structuredClone(demoBoard.nodes),
      edges: Array.isArray(parsed.edges) ? parsed.edges : structuredClone(demoBoard.edges),
    };
  } catch (error) {
    return structuredClone(demoBoard);
  }
}
