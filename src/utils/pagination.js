function getPaginationParams(req, defaultLimit = 10, maxLimit = 100) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip
  };
}

function buildPaginationMetadata(totalItems, page, limit) {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return {
    totalItems,
    totalPages,
    currentPage,
    limit,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null
  };
}

module.exports = {
  getPaginationParams,
  buildPaginationMetadata
};
