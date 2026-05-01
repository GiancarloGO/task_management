<?php
// Evitar que PHP muestre errores HTML dentro del JSON
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Conexión directa (sin archivo externo para evitar problemas de ruta) ──
$host = 'localhost';
$user = 'root';
$pass = '';           // En XAMPP la contraseña es vacía por defecto
$db   = 'task_management';

$conn = new mysqli($host, $user, $pass, $db);
$conn->set_charset('utf8mb4');

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de conexión: ' . $conn->connect_error]);
    exit;
}

// ── Variables de ruta ──────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

function clean(mysqli $c, $str): string {
    return $c->real_escape_string(htmlspecialchars(strip_tags(trim($str))));
}

// ── Enrutar ───────────────────────────────────────────────────────────────
switch ($method) {

    // ── GET: listar todas o una ────────────────────────────────────────────
    case 'GET':
        if ($id) {
            $r = $conn->query("SELECT * FROM tasks WHERE id = $id");
            $row = $r->fetch_assoc();
            echo $row ? json_encode($row) : json_encode(['error' => 'No encontrada']);
        } else {
            $r    = $conn->query("SELECT * FROM tasks ORDER BY created_at DESC");
            $rows = [];
            while ($row = $r->fetch_assoc()) $rows[] = $row;
            echo json_encode($rows);
        }
        break;

    // ── POST: crear ────────────────────────────────────────────────────────
    case 'POST':
        $body  = json_decode(file_get_contents('php://input'), true);
        $title = clean($conn, $body['title'] ?? '');
        $desc  = clean($conn, $body['description'] ?? '');

        if (!$title) {
            http_response_code(400);
            echo json_encode(['error' => 'El título es obligatorio']);
            break;
        }

        $conn->query("INSERT INTO tasks (title, description) VALUES ('$title', '$desc')");
        http_response_code(201);
        echo json_encode(['id' => $conn->insert_id, 'message' => 'Tarea creada']);
        break;

    // ── PUT: actualizar ────────────────────────────────────────────────────
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID requerido']);
            break;
        }

        $body      = json_decode(file_get_contents('php://input'), true);
        $title     = clean($conn, $body['title'] ?? '');
        $desc      = clean($conn, $body['description'] ?? '');
        $completed = isset($body['completed']) ? (int)(bool)$body['completed'] : null;

        if ($completed !== null && !$title) {
            // Solo actualizar estado
            $conn->query("UPDATE tasks SET completed = $completed WHERE id = $id");
        } else {
            if (!$title) {
                http_response_code(400);
                echo json_encode(['error' => 'El título es obligatorio']);
                break;
            }
            $comp = $completed ?? 0;
            $conn->query("UPDATE tasks SET title='$title', description='$desc', completed=$comp WHERE id=$id");
        }

        echo json_encode(['message' => 'Tarea actualizada']);
        break;

    // ── DELETE: eliminar ───────────────────────────────────────────────────
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID requerido']);
            break;
        }
        $conn->query("DELETE FROM tasks WHERE id = $id");
        echo json_encode(['message' => 'Tarea eliminada']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}

$conn->close();
?>