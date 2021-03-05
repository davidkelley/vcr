exports.primary = '#4169E1';

exports.secondary = '#88CDCE';

exports.success = '#228B22';

exports.warning = '#FFFF66';

exports.danger = '#DC143C';

exports.getStatusColor = (status) => {
  let ok = true;

  let statusColor = exports.success;

  if (status < 200 || status >= 300) {
    ok = false;
  }

  if (status >= 300 && status < 500) {
    statusColor = exports.warning;
  } else if (status >= 500) {
    statusColor = exports.danger;
  }

  return statusColor;
};
