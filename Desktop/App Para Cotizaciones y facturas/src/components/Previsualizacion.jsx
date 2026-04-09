export default function Previsualizacion({ modo, emisor, cliente, articulos, subtotal, itbis, total, tasaItbis, captureId }) {
  const esCotizacion = modo === 'cotizacion'
  const color = esCotizacion ? '#2563eb' : '#059669'
  const titulo = esCotizacion ? 'COTIZACIÓN' : 'FACTURA'

  return (
    <div
      id={captureId}
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        backgroundColor: '#ffffff',
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        boxSizing: 'border-box',
        fontSize: '12px',
        color: '#1e293b',
      }}
    >
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: color, margin: '0 0 4px 0', letterSpacing: '-1px' }}>
            {emisor.nombre || 'Mi Empresa'}
          </h1>
          {emisor.rnc && <p style={{ margin: '2px 0', color: '#64748b', fontSize: '11px' }}>RNC: {emisor.rnc}</p>}
          {emisor.direccion && <p style={{ margin: '2px 0', color: '#64748b', fontSize: '11px' }}>{emisor.direccion}</p>}
          {emisor.telefono && <p style={{ margin: '2px 0', color: '#64748b', fontSize: '11px' }}>Tel: {emisor.telefono}</p>}
          {emisor.email && <p style={{ margin: '2px 0', color: '#64748b', fontSize: '11px' }}>{emisor.email}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            backgroundColor: color,
            color: '#fff',
            fontSize: '22px',
            fontWeight: '800',
            letterSpacing: '3px',
            padding: '8px 20px',
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            {titulo}
          </div>
          <p style={{ margin: '3px 0', color: '#475569', fontSize: '11px' }}>
            <strong>No.:</strong> {cliente.comprobante || '—'}
          </p>
          <p style={{ margin: '3px 0', color: '#475569', fontSize: '11px' }}>
            <strong>Fecha:</strong> {cliente.fecha ? new Date(cliente.fecha + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </div>

      {/* Línea divisora */}
      <div style={{ borderTop: `3px solid ${color}`, marginBottom: '24px' }} />

      {/* Datos del cliente */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '28px',
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: color, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Facturar a:
        </p>
        <p style={{ margin: '2px 0', fontWeight: '700', fontSize: '14px' }}>{cliente.nombre || '—'}</p>
        {cliente.rnc && <p style={{ margin: '2px 0', color: '#64748b' }}>RNC/Cédula: {cliente.rnc}</p>}
        {cliente.direccion && <p style={{ margin: '2px 0', color: '#64748b' }}>{cliente.direccion}</p>}
      </div>

      {/* Tabla de artículos */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ backgroundColor: color, color: '#fff' }}>
            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '4px 0 0 0' }}>
              Descripción
            </th>
            <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '70px' }}>
              Cant.
            </th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '110px' }}>
              Precio Unit.
            </th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '110px', borderRadius: '0 4px 0 0' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {articulos.filter(a => a.descripcion || a.cantidad || a.precio).map((art, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #e2e8f0' }}>{art.descripcion || '—'}</td>
              <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>{art.cantidad || '0'}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                RD$ {parseFloat(art.precio || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', borderBottom: '1px solid #e2e8f0' }}>
                RD$ {parseFloat(art.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '260px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b' }}>Subtotal</span>
            <span style={{ fontWeight: '600' }}>RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b' }}>ITBIS ({tasaItbis}%)</span>
            <span style={{ fontWeight: '600' }}>RD$ {itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: color, color: '#fff', borderRadius: '6px', marginTop: '6px' }}>
            <span style={{ fontWeight: '800', fontSize: '14px' }}>TOTAL</span>
            <span style={{ fontWeight: '800', fontSize: '16px' }}>RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Pie de página */}
      <div style={{ marginTop: '48px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '10px' }}>
        <p style={{ margin: '2px 0' }}>
          {esCotizacion ? 'Esta cotización tiene una validez de 30 días a partir de la fecha de emisión.' : 'Gracias por su preferencia.'}
        </p>
        {emisor.email && <p style={{ margin: '2px 0' }}>{emisor.email} {emisor.telefono ? `· ${emisor.telefono}` : ''}</p>}
      </div>
    </div>
  )
}
