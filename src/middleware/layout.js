/**
 * Layout Middleware for GYMFLOW
 * Provides layout support for EJS templates by rendering inner view content into `<%- body %>`.
 */

function layoutMiddleware(req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = function (view, options = {}, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const mergedOptions = { ...res.locals, ...options };
    let layout = options.layout;

    // Explicitly disabled layout
    if (layout === false) {
      return originalRender(view, mergedOptions, callback);
    }

    // Determine layout if not explicitly specified
    if (layout === undefined) {
      if (view === 'landing' || view.startsWith('errors/')) {
        return originalRender(view, mergedOptions, callback);
      }
      if (view.startsWith('auth/')) {
        layout = 'layouts/auth';
      } else if (
        view.startsWith('member/') ||
        view.startsWith('trainer/') ||
        view.startsWith('admin/')
      ) {
        layout = 'layouts/main';
      } else {
        return originalRender(view, mergedOptions, callback);
      }
    }

    // 1. Render inner view content
    originalRender(view, mergedOptions, (err, bodyHtml) => {
      if (err) {
        if (typeof callback === 'function') {
          return callback(err);
        }
        return next(err);
      }

      // 2. Render layout with body content
      const layoutData = {
        ...mergedOptions,
        body: bodyHtml
      };

      originalRender(layout, layoutData, (layoutErr, fullHtml) => {
        if (layoutErr) {
          if (typeof callback === 'function') {
            return callback(layoutErr);
          }
          return next(layoutErr);
        }

        if (typeof callback === 'function') {
          return callback(null, fullHtml);
        }

        res.send(fullHtml);
      });
    });
  };

  next();
}

module.exports = {
  layoutMiddleware
};
