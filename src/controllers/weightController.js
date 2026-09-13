const WeightLog = require('../models/WeightLog');
const { formatDateString, normalizeDateOnly } = require('../utils/dateUtils');
const fitnessIntelligenceService = require('../services/fitnessIntelligenceService');
const logger = require('../utils/logger');

class WeightController {
  async showWeightPage(req, res, next) {
    try {
      const memberId = req.user._id;

      const [logs, intelligence] = await Promise.all([
        WeightLog.find({ member: memberId }).sort({ date: -1 }).lean(),
        fitnessIntelligenceService.getMemberIntelligence(memberId)
      ]);

      res.render('member/weight', {
        title: 'Body-Weight Progress Tracker',
        weightLogs: logs,
        weightTrend: intelligence.weight
      });
    } catch (error) {
      logger.error('Show weight page error', { error: error.message });
      next(error);
    }
  }

  async logWeight(req, res, next) {
    try {
      const memberId = req.user._id;
      const { weight, unit, date, notes } = req.body;

      const logDate = date ? new Date(date) : new Date();
      const dateString = formatDateString(logDate);

      // Check if entry already exists on this date for this member, if so update it
      let log = await WeightLog.findOne({ member: memberId, dateString });

      if (log) {
        log.weight = Number(weight);
        log.unit = unit || 'kg';
        log.notes = notes || '';
        await log.save();
        req.flash('success', `Updated weight entry for ${dateString}: ${weight} ${unit || 'kg'}`);
      } else {
        log = new WeightLog({
          member: memberId,
          weight: Number(weight),
          unit: unit || 'kg',
          date: normalizeDateOnly(logDate),
          dateString,
          notes: notes || ''
        });
        await log.save();
        req.flash('success', `Recorded body weight: ${weight} ${unit || 'kg'}`);
      }

      res.redirect('/member/weight');
    } catch (error) {
      logger.error('Log weight error', { error: error.message });
      req.flash('error', error.message || 'Failed to record weight entry');
      res.redirect('/member/weight');
    }
  }

  async deleteWeight(req, res, next) {
    try {
      const { id } = req.params;
      const memberId = req.user._id;

      const log = await WeightLog.findOneAndDelete({ _id: id, member: memberId });
      if (!log) {
        req.flash('error', 'Weight entry not found or unauthorized');
        return res.redirect('/member/weight');
      }

      req.flash('success', 'Weight record deleted');
      res.redirect('/member/weight');
    } catch (error) {
      logger.error('Delete weight error', { error: error.message });
      next(error);
    }
  }

  async getWeightApi(req, res, next) {
    try {
      const memberId = req.user._id;
      const logs = await WeightLog.find({ member: memberId }).sort({ date: 1 }).lean();

      const chartData = logs.map((l) => ({
        date: l.dateString,
        weight: l.weight,
        unit: l.unit
      }));

      res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      logger.error('Weight API error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to fetch weight data' });
    }
  }
}

module.exports = new WeightController();
