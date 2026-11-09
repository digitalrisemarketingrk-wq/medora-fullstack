"""Generate the browser's non-secret module catalog from its server definitions."""
import ast
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "backend/medora/practice_catalog.py"
tree = ast.parse(source.read_text(encoding="utf-8"))
nodes = [node for node in tree.body if
         isinstance(node, ast.FunctionDef) and node.name in {"field", "module"} or
         isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id in {"PATIENT", "NOTES", "MODULES"} for target in node.targets)]
namespace = {}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), namespace)
(root / "frontend/lib/practice-catalog.json").write_text(json.dumps(list(namespace["MODULES"].values()), indent=2) + "\n", encoding="utf-8")
