export default function EIPCompatibilityTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'eip', direction: 'asc' });
  const [eipData, setEipData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Google Sheets configuration
  const SHEET_ID = '1OGscheUSh-g15p7mNYjSaxI05E8O_3R3tDK0IwXaczk';

  useEffect(() => {
    loadGoogleSheetData();
  }, []);

  const loadGoogleSheetData = async () => {
    try {
      // Using Google Visualization API which supports CORS
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

      const response = await fetch(url);
      const text = await response.text();

      // Parse Google's JSON response (wrapped in google.visualization.Query.setResponse())
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const data = JSON.parse(jsonMatch[1]);
      const rows = data.table.rows;
      const cols = data.table.cols;

      // Convert to our format
      const parsed = rows.map(row => {
        const obj = {};
        cols.forEach((col, index) => {
          const value = row.c[index] ? row.c[index].v : null;
          const label = col.label || col.id;

          // Type conversion based on column name
          if (label === 'eip') {
            obj[label] = parseInt(value) || 0;
          } else if (label === 'critical') {
            obj[label] = value === true || value === 'TRUE';
          } else if (label === 'geth' || label === 'priority' || label === 'triage') {
            // Skip these columns
            return;
          } else {
            obj[label] = value || '';
          }
        });
        return obj;
      });

      setEipData(parsed);
      setLoading(false);
    } catch (err) {
      console.error('Error loading sheet data:', err);
      setError('Failed to load data from Google Sheets');
      setLoading(false);
      // Load fallback data
      loadFallbackData();
    }
  };

  const loadFallbackData = () => {
    // Embedded fallback data
    const fallback = [
      { eip: 7702, title: "Set Code for EOAs", status: "not_supported", critical: true, cosmos: "Not implemented", note: "We will support that fully in v0.5.0 - Requires compatibility discussion" },
      { eip: 155, title: "Simple replay attack protection", status: "partial", critical: true, cosmos: "Enforced through chain-wide params", note: "Currently enforcing as chain-wide params, plan for making it similar with Geth - Requires compatibility discussion", issue: "401" },
      // Add more fallback data as needed
    ];
    setEipData(fallback);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...eipData];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle null/undefined
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Convert to comparable values
        if (typeof aVal === 'boolean') {
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [eipData, sortConfig]);

  const filteredData = sortedData.filter(eip => {
    if (!eip || !eip.eip) return false;

    const matchesSearch =
      String(eip.eip).includes(searchTerm) ||
      (eip.title && eip.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (eip.note && eip.note.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || eip.status === statusFilter;
    const matchesCriticality = criticalityFilter === 'all' ||
      (criticalityFilter === 'critical' && eip.critical) ||
      (criticalityFilter === 'non-critical' && !eip.critical);

    return matchesSearch && matchesStatus && matchesCriticality;
  });

  const uniqueStatuses = [...new Set(eipData.map(eip => eip.status))];

  const statusColors = {
    'supported': 'text-green-600 dark:text-green-400',
    'partial': 'text-yellow-600 dark:text-yellow-400',
    'not_supported': 'text-red-600 dark:text-red-400',
    'not_applicable': 'text-gray-500 dark:text-gray-400',
    'unknown': 'text-gray-400 dark:text-gray-500'
  };


  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortConfig.direction === 'asc' ?
      <span className="text-blue-600 ml-1">↑</span> :
      <span className="text-blue-600 ml-1">↓</span>;
  };

  if (loading) {
    return <div className="text-center py-8">Loading EIP data from Google Sheets...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Using fallback data</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-black relative p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
      {/* Search and Filters - Sticky */}
      <div className="sticky top-0 z-20 bg-white dark:bg-black pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <input
              type="text"
              placeholder="Search by EIP number, title, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical Only</option>
            <option value="non-critical">Non-Critical Only</option>
          </select>
        </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredData.length} of {eipData.length} EIPs
            {error && <span className="ml-2 text-yellow-600">⚠ Using cached data</span>}
          </div>
        </div>
      </div>

      {/* Table with sticky header */}
      <div className="overflow-auto shadow-[0_0_0_1px_rgba(156,163,175,0.3)] dark:shadow-[0_0_0_1px_rgba(75,85,99,0.5)] rounded-lg mt-4" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 relative">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('eip')}
              >
                EIP <SortIcon column="eip" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('title')}
              >
                Title <SortIcon column="title" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon column="status" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('critical')}
              >
                Critical <SortIcon column="critical" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('cosmos')}
              >
                Implementation <SortIcon column="cosmos" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-gray-800">
            {filteredData.map((eip, index) => (
              <tr key={eip.eip} className={`${index % 2 === 0 ? 'bg-white dark:bg-black' : 'bg-gray-50 dark:bg-gray-900'} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  <a
                    href={`https://eips.ethereum.org/EIPS/eip-${eip.eip}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                  >
                    {eip.eip}
                  </a>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                  {eip.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`font-medium ${statusColors[eip.status]}`}>
                    {eip.status ? eip.status.replace(/_/g, ' ') : ''}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {eip.critical ? '✓' : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                  {eip.cosmos}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {eip.note}
                  {eip.issue && (
                    <a
                      href={`https://github.com/cosmos/evm/issues/${eip.issue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      #{eip.issue}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}