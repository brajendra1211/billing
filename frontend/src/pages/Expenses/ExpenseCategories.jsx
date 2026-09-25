import { useEffect, useState } from "react";
import { expensesApi } from "../../api/expenses.api";

export default function ExpenseCategories() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");

  const load = async () => {
    const res = await expensesApi.categoriesList();
    setRows(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return alert("Enter name");
    await expensesApi.categoryCreate({ name: name.trim(), is_active: 1 });
    setName("");
    await load();
  };

  const toggle = async (r) => {
    await expensesApi.categoryUpdate(r.id, { is_active: r.is_active ? 0 : 1 });
    await load();
  };

  return (
    <div>
      <h2 style={{ margin: 0 }}>Expense Categories</h2>

      <div style={{ marginTop: 12, border:"1px solid #eee", padding:12, borderRadius:10 }}>
        <h3 style={{ marginTop: 0 }}>Add Category</h3>
        <div style={{ display:"flex", gap:10 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent" />
          <button onClick={add}>Add</button>
        </div>
      </div>

      <div style={{ marginTop: 12, border:"1px solid #eee", padding:12, borderRadius:10 }}>
        <h3 style={{ marginTop: 0 }}>List</h3>
        <table style={{ width:"100%" }}>
          <thead><tr><th>ID</th><th>Name</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.is_active ? "Yes" : "No"}</td>
                <td><button onClick={() => toggle(r)}>{r.is_active ? "Disable" : "Enable"}</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="4" style={{ color:"#6b7280" }}>No categories</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
